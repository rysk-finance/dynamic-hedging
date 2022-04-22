pragma solidity >=0.8.9;
import "./tokens/ERC20.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IOracle.sol";
import "./interfaces/IMarginCalculator.sol";
import { Types } from "./libraries/Types.sol";
import "./interfaces/AddressBookInterface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import { LiquidityPool } from "./LiquidityPool.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import { OptionsCompute } from "./libraries/OptionsCompute.sol";
import { SafeTransferLib } from "./libraries/SafeTransferLib.sol";
import { OpynInteractions } from "./libraries/OpynInteractions.sol";
import { IController, GammaTypes} from "./interfaces/GammaInterface.sol";

contract OptionRegistry is Ownable, AccessControl {
    // address of the opyn oTokenFactory for oToken minting
    address internal oTokenFactory;
    // address of the gammaController for oToken operations
    address internal gammaController;
    // address of the collateralAsset
    address public immutable collateralAsset;
    // address of the opyn addressBook for accessing important opyn modules
    AddressBookInterface internal immutable addressBook;
    // address of the marginPool, contract for storing options collateral
    address internal marginPool;
    // address of the rysk liquidity pools
    address internal liquidityPool;
    // information of a series
    mapping(address => Types.OptionSeries) public seriesInfo;
    // vaultId that is responsible for a specific series address
    mapping(address => uint) public vaultIds;
    // issuance hash mapped against the series address
    mapping(bytes32 => address) seriesAddress;
    // vault counter
    uint64 public vaultCount;
    // max health threshold for calls
    uint64 public callUpperHealthFactor = 13_000;
    // min health threshold for calls
    uint64 public callLowerHealthFactor = 11_000;
    // max health threshold for puts
    uint64 public putUpperHealthFactor = 12_000;
    // min health threshold for puts
    uint64 public putLowerHealthFactor = 11_000;
    // BIPS
    uint256 private constant MAX_BPS = 10_000;
    // used to convert e18 to e8
    uint256 private constant SCALE_FROM = 10**10;
    // Access control role identifier
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    uint8 private constant OPYN_DECIMALS = 8;

    event OptionTokenCreated(address token);
    event SeriesRedeemed(address series, uint underlyingAmount, uint strikeAmount);
    event OptionsContractOpened(address indexed series, uint256 vaultId, uint256 optionsAmount);
    event OptionsContractClosed(address indexed series, uint256 vaultId, uint256 closedAmount);
    event OptionsContractSettled(address indexed series, uint256 collateralReturned, uint256 collateralLost, uint256 amountLost);

    error NotExpired();
    error HealthyVault();
    error AlreadyExpired();
    error NotLiquidityPool();
    error NonExistentSeries();
    error InsufficientBalance();

    /**
     * @dev Throws if called by any account other than the liquidity pool.
     */
    modifier onlyLiquidityPool() {
        if (msg.sender != liquidityPool) {revert NotLiquidityPool();}
        _;
    }

    constructor(address _collateralAsset, address _oTokenFactory, address _gammaController, address _marginPool, address _liquidityPool, address _addressBook) {
      collateralAsset = _collateralAsset;
      oTokenFactory = _oTokenFactory;
      gammaController = _gammaController;
      marginPool = _marginPool;
      liquidityPool = _liquidityPool;
      addressBook = AddressBookInterface(_addressBook);
      // Grant admin role to deployer
      _setupRole(ADMIN_ROLE, msg.sender);
    }

  /*********
    SETTERS
   ********/

    /**
     * @notice Set the liquidity pool address
     * @param  _newLiquidityPool set the liquidityPool address
     */
    function setLiquidityPool(address _newLiquidityPool) external onlyOwner {
      liquidityPool = _newLiquidityPool;
    }

    /**
     * @notice Set the health thresholds of the pool
     * @param  _putLower the lower health threshold for puts
     * @param  _putUpper the upper health threshold for puts
     * @param  _callLower the lower health threshold for calls
     * @param  _callUpper the upper health threshold for calls
     */
    function setHealthThresholds(uint64 _putLower, uint64 _putUpper, uint64 _callLower, uint64 _callUpper) external onlyOwner {
      putLowerHealthFactor = _putLower;
      putUpperHealthFactor = _putUpper;
      callLowerHealthFactor = _callLower;
      callUpperHealthFactor = _callUpper;
    }


  /**********************
    Primary functionality
   **********************/

    /**
     * @notice Either retrieves the option token if it already exists, or deploy it
     * @param  underlying is the address of the underlying asset of the option
     * @param  strikeAsset is the address of the collateral asset of the option
     * @param  expiration is the expiry timestamp of the option
     * @param  isPut the type of option
     * @param  strike is the strike price of the option - 1e18 format
     * @param collateral is the address of the asset to collateralize the option with
     * @return the address of the option
     */
    function issue(address underlying, address strikeAsset, uint256 expiration, bool isPut, uint256 strike, address collateral) external onlyLiquidityPool returns (address) {
        // deploy an oToken contract address
        if(expiration <= block.timestamp) {revert AlreadyExpired();}
        uint256 formattedStrike = formatStrikePrice(strike, collateral);
        // create option storage hash
        bytes32 issuanceHash = getIssuanceHash(underlying, strikeAsset, collateral, expiration, isPut, formattedStrike);
        // check for an opyn oToken if it doesn't exist deploy it
        address series = OpynInteractions.getOrDeployOtoken(oTokenFactory, collateral, underlying, strikeAsset, formattedStrike, expiration, isPut);
        // store the option data as a hash
        seriesInfo[series] = Types.OptionSeries(expiration, isPut, formattedStrike, underlying, strikeAsset, collateral);
        seriesAddress[issuanceHash] = series;
        emit OptionTokenCreated(series);
        return series;
    }

    /**
     * @notice Open an options contract using collateral from the liquidity pool
     * @param  _series the address of the option token to be created
     * @param  amount the amount of options to deploy
     * @param  collateralAmount the collateral required for the option
     * @dev only callable by the liquidityPool
     * @return if the transaction succeeded
     * @return the amount of collateral taken from the liquidityPool
     */
    function open(address _series, uint256 amount, uint256 collateralAmount) external onlyLiquidityPool returns (bool, uint256) {
        // make sure the options are ok to open
        Types.OptionSeries memory series = seriesInfo[_series];
        if(series.expiration <= block.timestamp) {revert AlreadyExpired();}
        // transfer collateral to this contract, collateral will depend on the option type
        SafeTransferLib.safeTransferFrom(series.collateral, msg.sender, address(this), collateralAmount);
        // mint the option token following the opyn interface
        IController controller = IController(gammaController);
        // check if a vault for this option already exists
        uint256 vaultId_ = vaultIds[_series];
        if (vaultId_ == 0) {
          vaultId_ = (controller.getAccountVaultCounter(address(this))) + 1;
          vaultCount++;
        } 
        uint256 mintAmount = OpynInteractions.createShort(gammaController, marginPool, _series, collateralAmount, vaultId_, amount, 1);
        emit OptionsContractOpened(_series, vaultId_, mintAmount);
        // transfer the option to the liquidity pool
        SafeTransferLib.safeTransfer(ERC20(_series), msg.sender, mintAmount);
        vaultIds[_series] = vaultId_;
        return (true, collateralAmount);
    }

    /**
     * @notice Close an options contract (oToken) before it has expired
     * @param  _series the address of the option token to be burnt
     * @param  amount the amount of options to burn
     * @dev only callable by the liquidityPool
     * @return if the transaction succeeded
     */
    function close(address _series, uint amount) external onlyLiquidityPool returns (bool, uint256) {
        // withdraw and burn
        Types.OptionSeries memory series = seriesInfo[_series];
        // make sure the option hasnt expired yet
        if(series.expiration <= block.timestamp) {revert AlreadyExpired();}
        // get the vault id
        uint256 vaultId = vaultIds[_series];
        uint256 convertedAmount = OptionsCompute.convertToDecimals(amount, IERC20(_series).decimals());
        // transfer the oToken back to this account
        SafeTransferLib.safeTransferFrom(_series, msg.sender, address(this), convertedAmount);
        // burn the oToken tracking the amount of collateral returned
        uint256 collatReturned = OpynInteractions.burnShort(gammaController, _series, convertedAmount, vaultId);
        SafeTransferLib.safeTransfer(ERC20(series.collateral), msg.sender, collatReturned);
        emit OptionsContractClosed(_series, vaultId, amount);
        return (true, collatReturned);
    }

    /**
     * @notice Settle an options vault
     * @param  _series the address of the option token to be burnt
     * @return success if the transaction succeeded
     * @return collatReturned the amount of collateral returned from the vault
     * @return collatLost the amount of collateral used to pay ITM options on vault settle
     * @return amountShort number of oTokens that the vault was short
     * @dev callable by anyone but returns funds to the liquidityPool
     */
    function settle(address _series) external returns (bool success, uint256 collatReturned, uint256 collatLost, uint256 amountShort) {
        Types.OptionSeries memory series = seriesInfo[_series];
        if (series.expiration == 0) {revert NonExistentSeries();}
        // check that the option has expired
        if (series.expiration >= block.timestamp) {revert NotExpired();}
        // get the vault
        uint256 vaultId = vaultIds[_series];
        // settle the vault
        (uint256 collatReturned, uint256 collatLost, uint amountShort) = OpynInteractions.settle(gammaController, vaultId);
        // transfer the collateral back to the liquidity pool
        SafeTransferLib.safeTransfer(ERC20(series.collateral), liquidityPool, collatReturned);
        emit OptionsContractSettled(_series, collatReturned, collatLost, amountShort);
        return (true, collatReturned, collatLost, amountShort);
    }

    /**
     * @notice Redeem oTokens for the locked collateral
     * @param  _series the address of the option token to be burnt and redeemed
     * @return amount returned
     */
    function redeem(address _series) external returns (uint256) {
        Types.OptionSeries memory series = seriesInfo[_series];
        if (series.expiration == 0) {revert NonExistentSeries();}
        // check that the option has expired
        if (series.expiration >= block.timestamp) {revert NotExpired();}
        if (IERC20(_series).balanceOf(msg.sender) == 0) {revert InsufficientBalance();}
        uint256 seriesBalance = IERC20(_series).balanceOf(msg.sender);
        // transfer the oToken back to this account
        SafeTransferLib.safeTransferFrom(_series, msg.sender, address(this), IERC20(_series).balanceOf(msg.sender));
        // redeem
        uint256 collatReturned = OpynInteractions.redeem(gammaController, marginPool, _series, seriesBalance);
        return collatReturned;
    }

    /**
     * @notice Send collateral funds for an option to be minted
     * @dev series.strike should be scaled by 1e8.
     * @param  series details of the option series
     * @param  amount amount of options to mint
     * @return amount transferred
     */
    function getCollateral(Types.OptionSeries memory series, uint256 amount) external view returns (uint256) {
        IMarginCalculator marginCalc = IMarginCalculator(addressBook.getMarginCalculator());
        uint256 collateralAmount = marginCalc.getNakedMarginRequired(
          series.underlying,
          series.strikeAsset,
          series.collateral,
          amount/ SCALE_FROM,
          series.strike,
          IOracle(addressBook.getOracle()).getPrice(series.underlying),
          series.expiration,
          IERC20(series.collateral).decimals(),
          series.isPut
        );
        // based on this collateral requirement and the health factor get the amount to deposit
        uint256 upperHealthFactor = series.isPut ? putUpperHealthFactor : callUpperHealthFactor;
        collateralAmount = ((collateralAmount * upperHealthFactor) / MAX_BPS);
      return collateralAmount;
    }

    /**
     * @notice Retrieves the option token if it exists
     * @param  underlying is the address of the underlying asset of the option
     * @param  strikeAsset is the address of the collateral asset of the option
     * @param  expiration is the expiry timestamp of the option
     * @param  isPut the type of option
     * @param  strike is the strike price of the option - 1e18 format
     * @param  collateral is the address of the asset to collateralize the option with
     * @return the address of the option
     */
    function getOtoken(address underlying, address strikeAsset, uint expiration, bool isPut, uint strike, address collateral) external view returns (address) {
        // check for an opyn oToken
        address series = OpynInteractions.getOtoken(oTokenFactory, collateral, underlying, strikeAsset, formatStrikePrice(strike, collateral), expiration, isPut);
        return series;
    }

  /*********************
    Vault health checks
   *********************/

    /**
     * @notice check the health of a specific vault to see if it requires collateral
     * @param  vaultId the id of the vault to check
     * @return isBelowMin bool to determine whether the vault needs topping up
     * @return isAboveMax bool to determine whether the vault is too overcollateralised
     * @return healthFactor the health factor of the vault in MAX_BPS format
     * @return collatRequired the amount of collateral required to return the vault back to normal
     * @return collatAsset the address of the collateral asset
     */
    function checkVaultHealth(uint256 vaultId) public view returns (bool isBelowMin, bool isAboveMax, uint256 healthFactor, uint256 collatRequired, address collatAsset) {
      // run checks on the vault health
      // get the vault details from the vaultId
      GammaTypes.Vault memory vault = IController(gammaController).getVault(address(this), vaultId);
      // get the series
      Types.OptionSeries memory series = seriesInfo[vault.shortOtokens[0]];
      // get the MarginRequired
      IMarginCalculator marginCalc = IMarginCalculator(addressBook.getMarginCalculator());
    
      uint256 marginReq = marginCalc.getNakedMarginRequired(
          series.underlying,
          series.strikeAsset,
          series.collateral,
          vault.shortAmounts[0],
          series.strike,
          IOracle(addressBook.getOracle()).getPrice(series.underlying),
          series.expiration,
          IERC20(series.collateral).decimals(),
          series.isPut
        );
      // get the amount held in the vault
      uint256 collatAmount = vault.collateralAmounts[0];
      // divide the amount held in the vault by the margin requirements to get the health factor
      healthFactor = (collatAmount * MAX_BPS) / marginReq;
      // set the upper and lower health factor depending on if the series is a put or a call
      uint256 upperHealthFactor = series.isPut ? putUpperHealthFactor : callUpperHealthFactor;
      uint256 lowerHealthFactor = series.isPut ? putLowerHealthFactor : callLowerHealthFactor;
      // if the vault health is above a certain threshold then the vault is above safe margins and collateral can be withdrawn
      if (healthFactor > upperHealthFactor) {
        isAboveMax = true;
        // calculate the margin to remove from the vault
        collatRequired = collatAmount - ((marginReq * upperHealthFactor) / MAX_BPS);
      } else if (healthFactor < lowerHealthFactor) {
        isBelowMin = true;
        // calculate the margin to add to the vault
        collatRequired = ((marginReq * upperHealthFactor) / MAX_BPS) - collatAmount;
      }
      collatAsset = series.collateral;
    }

    /**
     * @notice adjust the collateral held in a specific vault because of health
     * @param  vaultId the id of the vault to check
     */
    function adjustCollateral(uint256 vaultId) external onlyRole(ADMIN_ROLE) {
      (bool isBelowMin, bool isAboveMax,,uint256 collateralAmount, address collateralAsset) = checkVaultHealth(vaultId);
      if (!isBelowMin && !isAboveMax) {revert HealthyVault();}
      if (isBelowMin) {
        LiquidityPool(liquidityPool).adjustCollateral(collateralAmount, false);
        // transfer the needed collateral to this contract from the liquidityPool
        SafeTransferLib.safeTransferFrom(collateralAsset, liquidityPool, address(this), collateralAmount);
        // increase the collateral in the vault (make sure balance change is recorded in the LiquidityPool)
        OpynInteractions.depositCollat(gammaController, marginPool, collateralAsset, collateralAmount, vaultId);
      } else if (isAboveMax) {
        LiquidityPool(liquidityPool).adjustCollateral(collateralAmount, true);
        // decrease the collateral in the vault (make sure balance change is recorded in the LiquidityPool)
        OpynInteractions.withdrawCollat(gammaController, collateralAsset, collateralAmount, vaultId);
        // transfer the excess collateral to the liquidityPool from this address
        SafeTransferLib.safeTransfer(ERC20(collateralAsset), liquidityPool, collateralAmount);
      }
    }

    /**
     * @notice adjust the collateral held in a specific vault because of health, using collateral from the caller. Only takes 
     *         from msg.sender, doesnt give them if vault is above the max.
     * @param  vaultId the id of the vault to check
     * @dev    this is a safety function, if worst comes to worse any caller can collateralise a vault to save it.
     */
    function adjustCollateralCaller(uint256 vaultId) external onlyRole(ADMIN_ROLE) {
      (bool isBelowMin,,,uint256 collateralAmount, address collateralAsset) = checkVaultHealth(vaultId);
      if (!isBelowMin) {revert HealthyVault();}
      // transfer the needed collateral to this contract from the msg.sender
      SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(this), collateralAmount);
      // increase the collateral in the vault (make sure balance change is recorded in the LiquidityPool)
      OpynInteractions.depositCollat(gammaController, marginPool, collateralAsset, collateralAmount, vaultId);
    }

    /**
     * @notice withdraw collateral from a fully liquidated vault
     * @param  vaultId the id of the vault to check
     * @dev    this is a safety function, if a vault is liquidated.
     */
    function wCollatLiquidatedVault(uint256 vaultId) external onlyRole(ADMIN_ROLE) {
      // get the vault details from the vaultId
      GammaTypes.Vault memory vault = IController(gammaController).getVault(address(this), vaultId);
      require(vault.shortAmounts[0] == 0, "Vault has short positions [amount]");
      require(vault.shortOtokens[0] == address(0), "Vault has short positions [token]");
      require(vault.collateralAmounts[0] > 0, "Vault has no collateral");
      // decrease the collateral in the vault (make sure balance change is recorded in the LiquidityPool)
      OpynInteractions.withdrawCollat(gammaController, vault.collateralAssets[0], vault.collateralAmounts[0], vaultId);
      // transfer the excess collateral to the liquidityPool from this address
      SafeTransferLib.safeTransfer(ERC20(vault.collateralAssets[0]), liquidityPool, vault.collateralAmounts[0]);
    }
    
  /*********
    GETTERS
   *********/

   function getSeriesAddress(bytes32 issuanceHash) public view returns (address) {
     return seriesAddress[issuanceHash];
   }

   function getSeriesInfo(address series)
     public
     view
     returns (Types.OptionSeries memory) {
     return seriesInfo[series];
   }

   function getIssuanceHash(Types.OptionSeries memory _series) public pure returns (bytes32) {
     return getIssuanceHash(_series.underlying, _series.strikeAsset, _series.collateral, _series.expiration, _series.isPut, _series.strike);
   }

    /**
     * Helper function for computing the hash of a given issuance.
     */
    function getIssuanceHash(address underlying, address strikeAsset, address collateral, uint expiration, bool isPut, uint strike)
      internal
      pure
      returns(bytes32)
    {
      return keccak256(
         abi.encodePacked(underlying, strikeAsset, collateral, expiration, isPut, strike)
      );
    }

    /**
     * @notice Converts strike price to 1e8 format and floors least significant digits if needed
     * @param  strikePrice strikePrice in 1e18 format
     * @param  collateral address of collateral asset
     * @return if the transaction succeeded
     */
    function formatStrikePrice(
        uint256 strikePrice,
        address collateral
    ) internal view returns (uint) {
        // convert strike to 1e8 format
        uint price = strikePrice / (10**10);
        uint collateralDecimals = IERC20(collateral).decimals();
        if (collateralDecimals >= OPYN_DECIMALS) return price;
        uint difference = OPYN_DECIMALS - collateralDecimals;
        // round floor strike to prevent errors in Gamma protocol
        return price / (10**difference) * (10**difference);
    }

}
