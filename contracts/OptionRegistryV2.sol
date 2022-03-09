pragma solidity >=0.8.9;
import "./tokens/ERC20.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IOracle.sol";
import "./utils/access/Ownable.sol";
import "./interfaces/IMarginCalculator.sol";
import { Types } from "./libraries/Types.sol";
import "./interfaces/AddressBookInterface.sol";
import { IController} from "./interfaces/GammaInterface.sol";
import { OptionsCompute } from "./libraries/OptionsCompute.sol";
import { OpynInteractionsV2 } from "./libraries/OpynInteractionsV2.sol";
import { SafeTransferLib } from "./libraries/SafeTransferLib.sol";
import "hardhat/console.sol";

contract OptionRegistryV2 is Ownable {

    // public versioning of the contract for external use
    string public constant VERSION = "1.0";
    uint8 private constant OPYN_DECIMALS = 8;
    // address of the usd asset used
    // TODO: maybe make into flexible usd
    address internal usd;
    // address of the opyn oTokenFactory for oToken minting
    address internal oTokenFactory;
    // address of the gammaController for oToken operations
    address internal gammaController;
    // address of the opyn addressBook for accessing important opyn modules
    AddressBookInterface internal addressBook;
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
    // max health threshold in e6 decimals
    uint64 public upperHealthFactor = 1000000000;
    // min health threshold in e6 decimals
    uint64 public lowerHealthFactor = 800000000;
  
    // used to convert e18 to e8
    uint256 private constant SCALE_FROM = 10**10;

    event OptionTokenCreated(address token);
    event SeriesRedeemed(address series, uint underlyingAmount, uint strikeAmount);
    event OptionsContractOpened(address indexed series, uint256 vaultId, uint256 optionsAmount);
    event OptionsContractClosed(address indexed series, uint256 vaultId, uint256 closedAmount);
    event OptionsContractSettled(address indexed series);

    /**
     * @dev Throws if called by any account other than the liquidity pool.
     */
    modifier onlyLiquidityPool() {
        require(msg.sender == liquidityPool, "!liquidityPool");
        _;
    }

    constructor(address usdToken, address _oTokenFactory, address _gammaController, address _marginPool, address _liquidityPool, address _addressBook) {
      usd = usdToken;
      oTokenFactory = _oTokenFactory;
      gammaController = _gammaController;
      marginPool = _marginPool;
      liquidityPool = _liquidityPool;
      addressBook = AddressBookInterface(_addressBook);
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
     * @param  _lower the lower health threshold
     * @param  _upper the upper health threshold
     */
    function setHealthThresholds(uint64 _lower, uint64 _upper) external onlyOwner {
      lowerHealthFactor = _lower;
      upperHealthFactor = _upper;
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
        require(expiration > block.timestamp, "Already expired");
        uint256 formattedStrike = formatStrikePrice(strike, collateral);
        // create option storage hash
        bytes32 issuanceHash = getIssuanceHash(underlying, strikeAsset, collateral, expiration, isPut, formattedStrike);
        // check for an opyn oToken if it doesn't exist deploy it
        address series = OpynInteractionsV2.getOrDeployOtoken(oTokenFactory, collateral, underlying, strikeAsset, formattedStrike, expiration, isPut);
        // store the option data as a hash
        seriesInfo[series] = Types.OptionSeries(expiration, isPut, formattedStrike, underlying, strikeAsset, collateral);
        seriesAddress[issuanceHash] = series;
        emit OptionTokenCreated(series);
        return series;
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

    /**
     * @notice Open an options contract using collateral from the liquidity pool
     * @param  _series the address of the option token to be created
     * @param  amount the amount of options to deploy
     * @dev only callable by the liquidityPool
     * @return if the transaction succeeded
     * @return the amount of collateral taken from the liquidityPool
     */
    function open(address _series, uint256 amount) external onlyLiquidityPool returns (bool, uint256) {
        // make sure the options are ok to open
        Types.OptionSeries memory series = seriesInfo[_series];
        require(block.timestamp < series.expiration, "Options can not be opened after expiration");
        // TODO: calculate value including a buffer
        uint256 collateralAmount = getCollateral(series, amount);
        // mint the option token following the opyn interface
        IController controller = IController(gammaController);
        // check if a vault for this option already exists
        uint256 vaultId_ = vaultIds[_series];
        if (vaultId_ == 0) {
          vaultId_ = (controller.getAccountVaultCounter(address(this))) + 1;
          vaultCount++;
        } 
        uint256 mintAmount = OpynInteractionsV2.createShort(gammaController, marginPool, _series, collateralAmount, vaultId_, amount, 1);
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
        require(block.timestamp < series.expiration, "Option already expired");
        // get the vault id
        uint256 vaultId = vaultIds[_series];
        uint256 convertedAmount = OptionsCompute.convertToDecimals(amount, IERC20(_series).decimals());
        // transfer the oToken back to this account
        SafeTransferLib.safeTransferFrom(_series, msg.sender, address(this), convertedAmount);
        // burn the oToken tracking the amount of collateral returned
        // TODO: account for fact there might be a buffer
        uint256 collatReturned = OpynInteractionsV2.burnShort(gammaController, _series, convertedAmount, vaultId);
        SafeTransferLib.safeTransfer(ERC20(series.collateral), msg.sender, collatReturned);
        emit OptionsContractClosed(_series, vaultId, amount);
        return (true, collatReturned);
    }

    /**
     * @notice Settle an options vault
     * @param  _series the address of the option token to be burnt
     * @return if the transaction succeeded
     * @dev callable by anyone but returns funds to the liquidityPool
     */
    function settle(address _series) external returns (bool) {
        Types.OptionSeries memory series = seriesInfo[_series];
        require(series.expiration != 0, "non-existent series");
        // check that the option has expired
        require(block.timestamp > series.expiration, "option not past expiry");
        // get the vault
        uint256 vaultId = vaultIds[_series];
        // settle the vault
        uint256 collatReturned = OpynInteractionsV2.settle(gammaController, vaultId);
        // transfer the collateral back to the liquidity pool
        SafeTransferLib.safeTransfer(ERC20(series.collateral), liquidityPool, collatReturned);
        emit OptionsContractSettled(_series);
        return true;
    }

    /**
     * @notice Redeem oTokens for the locked collateral
     * @param  _series the address of the option token to be burnt and redeemed
     * @return amount returned
     */
    function redeem(address _series) external returns (uint256) {
        Types.OptionSeries memory series = seriesInfo[_series];
        require(series.expiration != 0, "non-existent series");
        // check that the option has expired
        require(block.timestamp > series.expiration, "option not past expiry");
        require(IERC20(_series).balanceOf(msg.sender) > 0, "insufficient option tokens");
        uint256 seriesBalance = IERC20(_series).balanceOf(msg.sender);
        // transfer the oToken back to this account
        SafeTransferLib.safeTransferFrom(_series, msg.sender, address(this), IERC20(_series).balanceOf(msg.sender));
        // redeem
        uint256 collatReturned = OpynInteractionsV2.redeem(gammaController, marginPool, _series, seriesBalance);
        return collatReturned;
    }

    /**
     * @notice Send collateral funds for an option to be minted
     * @param  series details of the option series
     * @param  amount amount of underlying to transfer
     * @return amount transferred
     */
    function getCollateral(Types.OptionSeries memory series, uint256 amount) internal returns (uint256) {
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
        // add in logic for increasing the collateral requirement depending on the liquidation health factor here, probably want to default to 100% health factor.
        // transfer collateral to this contract, collateral will depend on the option type
        SafeTransferLib.safeTransferFrom(series.collateral, msg.sender, address(this), collateralAmount);
      return collateralAmount;
    }

  /*********************
    Vault health checks
   *********************/

    /**
     * @notice check the health of a specific vault to see if it requires collateral
     * @param  vaultId the id of the vault to check
     * @return bool to determine whether the vault needs topping up
     * @return bool to determine whether the vault is too overcollateralised
     * @return the health factor of the vault in e6 decimal
     * @return the amount of collateral required to return the vault back to normal
     */
    function checkVaultHealth(uint256 vaultId) public view returns (bool, bool, uint256, uint256) {
      // run checks on the vault health
      // if the vault health is above a certain threshold then the vault is above safe margins and needs to lose some collateral
      // if the vault health is below a certain threshold then the vault is below safe margins and needs to gain some collateral
    }

    /**
     * @notice adjust the collateral held in a specific vault because of health
     * @param  vaultId the id of the vault to check
     */
    function adjustVault(uint256 vaultId) external {
      (bool isBelowMin, bool isAboveMax, uint256 collateralAmount,) = checkVaultHealth(vaultId);
      require(isBelowMin || isAboveMax, "vault is healthy");
      if (isBelowMin) {
        // increase the collateral in the vault (make sure balance change is recorded in the LiquidityPool)
      } else if (isAboveMax) {
        // decrease the collateral in the vault (make sure balance change is recorded in the LiquidityPool)
      }
      
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

}
