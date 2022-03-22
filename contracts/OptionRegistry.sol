pragma solidity >=0.8.9;
import "./tokens/ERC20.sol";
import "./interfaces/IERC20.sol";
import { Types } from "./libraries/Types.sol";
import "./interfaces/AddressBookInterface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import { IController} from "./interfaces/GammaInterface.sol";
import { OptionsCompute } from "./libraries/OptionsCompute.sol";
import {OpynInteractions} from "./libraries/OpynInteractions.sol";
import { SafeTransferLib } from "./libraries/SafeTransferLib.sol";
import "hardhat/console.sol";

contract OptionRegistry is Ownable {

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
    // amount of openInterest (assets) held in a specific series
    mapping(address => uint) public openInterest;
    // amount of assets held in a series by an address
    mapping(address => mapping(address => uint)) public writers;
    // information of a series
    mapping(address => Types.OptionSeries) public seriesInfo;
    // vaultId that is responsible for a specific series address
    mapping(address => uint) public vaultIds;
    // issuance hash mapped against the series address
    mapping(bytes32 => address) seriesAddress;

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

    /**
     * @notice Set the liquidity pool address
     * @param  _newLiquidityPool set the liquidityPool address
     */
    function setLiquidityPool(address _newLiquidityPool) external onlyOwner {
      liquidityPool = _newLiquidityPool;
    }

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
    function issue(address underlying, address strikeAsset, uint expiration, bool isPut, uint strike, address collateral) external returns (address) {
        // deploy an oToken contract address
        require(expiration > block.timestamp, "Already expired");
        // create option storage hash
        address u = underlying;
        address s = strikeAsset;
        bytes32 issuanceHash = getIssuanceHash(underlying, strikeAsset, expiration, isPut, strike);
        //address collateralAsset = collateral == address(0) ? usd : collateral;
        // check for an opyn oToken if it doesn't exist deploy it
        address series = OpynInteractions.getOrDeployOtoken(oTokenFactory, collateral, underlying, strikeAsset, formatStrikePrice(strike, collateral), expiration, isPut);
        // store the option data as a hash
        seriesInfo[series] = Types.OptionSeries(expiration, isPut, strike, u, s, collateral);
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
    function open(address _series, uint amount) external onlyLiquidityPool returns (bool, uint256) {
        // make sure the options are ok to open
        Types.OptionSeries memory series = seriesInfo[_series];
        require(block.timestamp < series.expiration, "Options can not be opened after expiration");
        uint256 collateralAmount;
    
        // transfer collateral to this contract, collateral will depend on the option type
        if (!series.isPut) {
          collateralAmount = getCallCollateral(series.underlying, amount);
        } else {
          collateralAmount = getPutCollateral(series.strikeAsset, amount, series.strike);
        }
        // mint the option token following the opyn interface
        IController controller = IController(gammaController);
        // check if a vault for this option already exists
        uint256 vaultId = vaultIds[_series];
        if (vaultId == 0) {
          vaultId = (controller.getAccountVaultCounter(address(this))) + 1;
        } 
        uint256 mintAmount = OpynInteractions.createShort(gammaController, marginPool, _series, collateralAmount, vaultId, amount);
        // transfer the option to the liquidity pool
        SafeTransferLib.safeTransfer(ERC20(_series), msg.sender, mintAmount);
        openInterest[_series] += amount;
        writers[_series][msg.sender] += amount;
        vaultIds[_series] = vaultId;
        emit OptionsContractOpened(_series, vaultId, mintAmount);
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
        // make sure the option was issued by this account
        require(openInterest[_series] >= amount);
        // get the vault id
        uint256 vaultId = vaultIds[_series];
        // transfer the oToken back to this account
        SafeTransferLib.safeTransferFrom(_series, msg.sender, address(this), OptionsCompute.convertToDecimals(amount, IERC20(_series).decimals()));
        // burn the oToken tracking the amount of collateral returned
        uint256 collatReturned = OpynInteractions.burnShort(gammaController, marginPool, _series, amount, vaultId);

        require(writers[_series][msg.sender] >= collatReturned, "Caller did not write sufficient amount");
        writers[_series][msg.sender] -= collatReturned;
        openInterest[_series] -= collatReturned;

        if (!series.isPut) {
          transferOutUnderlying(series, collatReturned);
        } else {
          transferOutStrike(series, collatReturned);
        }
        emit OptionsContractClosed(_series, vaultId, amount);
        return (true, collatReturned);
    }

    /**
     * @notice Settle an options vault
     * @param  _series the address of the option token to be burnt
     * @return if the transaction succeeded
     * @dev only callable by the liquidityPool
     */
    function settle(address _series) external onlyLiquidityPool returns (bool) {
        Types.OptionSeries memory series = seriesInfo[_series];
        require(series.expiration != 0, "non-existent series");
        // check that the option has expired
        require(block.timestamp > series.expiration, "option not past expiry");
        // get the vault
        uint256 vaultId = vaultIds[_series];
        // settle the vault
        uint256 collatReturned = OpynInteractions.settle(gammaController, vaultId);
        openInterest[_series] = 0;
        writers[_series][msg.sender] = 0;
        // transfer the collateral back to the liquidity pool
        if (!series.isPut) {
          transferOutUnderlying(series, collatReturned);
        } else {
          transferOutStrike(series, collatReturned);
        }
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
        uint256 amount = OpynInteractions.redeem(gammaController, marginPool, _series, seriesBalance);
        return amount;
    }

    /**
     * @notice Send collateral funds for a call option to be minted
     * @param  underlying address of the asset to transfer
     * @param  amount amount of underlying to transfer
     * @return amount transferred
     */
    function getCallCollateral(address underlying, uint amount) internal returns (uint256) {
      SafeTransferLib.safeTransferFrom(underlying, msg.sender, address(this), amount);
      return amount;
    }

    /**
     * @notice Send collateral funds for a put option to be minted
     * @param  strikeAsset address of the asset to transfer
     * @param  amount amount of underlying to transfer
     * @param  strike the strike of the option
     * @return amount transferred
     */
    function getPutCollateral(address strikeAsset, uint amount, uint strike) internal returns (uint256) {
        uint escrow = OptionsCompute.computeEscrow(amount, strike, IERC20(strikeAsset).decimals());
        SafeTransferLib.safeTransferFrom(strikeAsset, msg.sender, address(this), escrow);
        return escrow;
    }

    /**
     * @notice Send collateral funds to the liquidityPool
     * @param  _series address of the oToken
     * @param  amount amount of underlying to transfer
     */
   function transferOutUnderlying(Types.OptionSeries memory _series, uint amount) internal {
     SafeTransferLib.safeTransfer(ERC20(_series.underlying), msg.sender, amount);
    }

    /**
     * @notice Send collateral funds to the liquidityPool
     * @param  _series address of the oToken
     * @param  amount amount of strike to transfer
     */
   function transferOutStrike(Types.OptionSeries memory _series, uint amount) internal {
     SafeTransferLib.safeTransfer(ERC20(_series.strikeAsset), msg.sender, amount);
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
     return getIssuanceHash(_series.underlying, _series.strikeAsset, _series.expiration, _series.isPut, _series.strike);
   }

    /**
     * Helper function for computing the hash of a given issuance.
     */
    function getIssuanceHash(address underlying, address strikeAsset, uint expiration, bool isPut, uint strike)
      internal
      pure
      returns(bytes32)
    {
      return keccak256(
         abi.encodePacked(underlying, strikeAsset, expiration, isPut, strike)
      );
    }

}
