pragma solidity >=0.8.0;

import "./PriceFeed.sol";
import "./tokens/ERC20.sol";
import "./OptionRegistry.sol";
import "./OptionsProtocol.sol";
import "./utils/ReentrancyGuard.sol";
import "./libraries/BlackScholes.sol";
import "./interfaces/IHedgingReactor.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import { Constants } from "./libraries/Constants.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import { OptionsCompute } from "./libraries/OptionsCompute.sol";
import { SafeTransferLib } from "./libraries/SafeTransferLib.sol";

import "hardhat/console.sol";

error IVNotFound();
error InvalidPrice();
error InvalidBuyer();
error OrderExpired();
error InvalidAmount();
error IssuanceFailed();
error DeltaNotDecreased();
error NonExistentOtoken();
error InvalidShareAmount();
error TotalSupplyReached();
error StrikeAssetInvalid();
error OptionStrikeInvalid();
error OptionExpiryInvalid();
error CollateralAssetInvalid();
error UnderlyingAssetInvalid();
error CollateralAmountInvalid();
error WithdrawExceedsLiquidity();
error MaxLiquidityBufferReached();
error CustomOrderInsufficientPrice();
error CustomOrderInvalidDeltaValue();
error DeltaQuoteError(uint256 quote, int256 delta);
error StrikeAmountExceedsLiquidity(uint256 strikeAmount, uint256 strikeLiquidity);
error MinStrikeAmountExceedsLiquidity(uint256 strikeAmount, uint256 strikeAmountMin);
error UnderlyingAmountExceedsLiquidity(uint256 underlyingAmount, uint256 underlyingLiquidity);
error MinUnderlyingAmountExceedsLiquidity(uint256 underlyingAmount, uint256 underlyingAmountMin);

contract LiquidityPool is
  ERC20,
  Ownable,
  AccessControl,
  ReentrancyGuard,
  Pausable
{
  using PRBMathSD59x18 for int256;
  using PRBMathUD60x18 for uint256;

  // Access control role identifier
  bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");


  uint256 private constant ONE_YEAR_SECONDS = 31557600;
  // standard expected decimals of ERC20s
  uint8 private constant SCALE_DECIMALS = 18;
  // BIPS
  uint256 MAX_BPS = 10_000;
  // buffer of funds to not be used to write new options in case of margin requirements (as percentage - for 20% enter 2000)
  uint public bufferPercentage = 2000;
  // list of addresses for hedging reactors
  address[] public hedgingReactors;
  // Protocol management contract
  address public protocol;
  // asset that denominates the strike price
  address public strikeAsset;
  // asset that is used as the reference asset
  address public underlyingAsset;
  // asset that is used for collateral asset
  address public collateralAsset;
  // riskFreeRate as a percentage PRBMath Float. IE: 3% -> 0.03 * 10**18
  uint public riskFreeRate;
  // amount of strikeAsset allocated as collateral
  uint public collateralAllocated;
  // amount of underlyingAsset allocated as collateral
  uint public underlyingAllocated;
  // max total supply of the lp shares
  uint public maxTotalSupply = type(uint256).max;
  // Maximum discount that an option tilting factor can discount an option price
  uint public maxDiscount = PRBMathUD60x18.SCALE.div(10); // As a percentage. Init at 10%
  // total number of calls active
  uint public totalAmountCall;
  // total number of puts active
  uint public totalAmountPut;
  // the weighted strike price of all active calls
  uint public weightedStrikeCall;
  // the weighted time to expiry of all active calls
  uint public weightedTimeCall;
  // the weighted strike of all active puts
  uint public weightedStrikePut;
  // the weighted time to expiry of all active puts
  uint public weightedTimePut;
  // skew parameters for calls
  int[7] public callsVolatilitySkew;
  // skew parameters for puts
  int[7] public putsVolatilitySkew;
  // The spread between the bid and ask on the IV skew;
  // Consider making this it's own volatility skew if more flexibility is needed
  uint public bidAskIVSpread;
  // Implied volatility for an underlying
  mapping(address => uint) public impliedVolatility;
  // value below which delta is not worth hedging due to gas costs
  int256 private dustValue;
  // addresses that are whitelisted to sell options back to the protocol
  mapping(address => bool) public buybackWhitelist;
  // custom option orders
  mapping(uint256 => Types.Order) public orderStores;
  // order id counter
  uint256 public orderIdCounter;
  // strangle order pairings. Each strangle id maps to 2 custom order indices
  mapping(uint256 => uint256[2]) public strangleOrderPairs;
  // strangle id counter
  uint256 public strangleIdCounter;
  // delta and price boundaries for custom orders
  // call delta will always be between 0 and 1 (e18)
  // put delta will always be between 0 and -1 (e18)
  // maxPriceRange is the maximum percentage below the LP calculated price, measured in BPS, that the order may be sold for.
  // 10% would mean maxPriceRange = 1000
  struct CustomOrderBounds {
    uint128 callMinDelta;
    uint128 callMaxDelta;
    int128 putMinDelta;
    int128 putMaxDelta;
    uint32 maxPriceRange;
  }

  CustomOrderBounds public customOrderBounds = CustomOrderBounds(
    0,
    25e16,
    -25e16,
    0,
    1000
  );
  // strike and expiry date range for options
  struct OptionParams {
    uint128 minCallStrikePrice;
    uint128 maxCallStrikePrice;
    uint128 minPutStrikePrice;
    uint128 maxPutStrikePrice;
    uint128 minExpiry;
    uint128 maxExpiry;
  }

  OptionParams public optionParams;

  event OrderCreated(uint orderId);
  event LiquidityAdded(uint amount);
  event StrangleCreated(uint strangleId);
  event UnderlyingAdded(address underlying);
  event ImpliedVolatilityUpdated(address underlying, uint iv);
  event Deposit(address recipient, uint strikeAmount, uint shares);
  event Withdraw(address recipient, uint shares,  uint strikeAmount);
  event WriteOption(address series, uint amount, uint premium, uint escrow, address buyer);
  event BuybackOption(address series, uint amount, uint premium, uint escrowReturned, address seller);
  event SettleVault(address series, uint collateralReturned, uint collateralLost, address closer);


  constructor
  (
    address _protocol, 
    address _strikeAsset, 
    address _underlyingAsset, 
    address _collateralAsset, 
    uint rfr, 
    int[7] memory callSkew, 
    int[7] memory putSkew, 
    string memory name, 
    string memory symbol,
    OptionParams memory _optionParams,
    address adminAddress
  ) ERC20(name, symbol, 18) 
  {
    // Grant admin role to deployer
    _setupRole(ADMIN_ROLE, adminAddress);
    strikeAsset = _strikeAsset;
    riskFreeRate = rfr;
    address underlyingAddress = _underlyingAsset;
    underlyingAsset = underlyingAddress;
    collateralAsset = _collateralAsset;
    callsVolatilitySkew = callSkew;
    putsVolatilitySkew = putSkew;
    protocol = _protocol;
    optionParams.minCallStrikePrice = _optionParams.minCallStrikePrice;
    optionParams.maxCallStrikePrice = _optionParams.maxCallStrikePrice;
    optionParams.minPutStrikePrice = _optionParams.minPutStrikePrice;
    optionParams.maxPutStrikePrice = _optionParams.maxPutStrikePrice;
    optionParams.minExpiry = _optionParams.minExpiry;
    optionParams.maxExpiry = _optionParams.maxExpiry;
    maxTotalSupply = type(uint256).max;
    emit UnderlyingAdded(underlyingAddress);
  }

  function pauseContract() public onlyOwner{
    _pause();
  }

  function unpause() public onlyOwner{
    _unpause();
  }

  function addBuybackAddress(address _addressToWhitelist) public onlyOwner {
    buybackWhitelist[_addressToWhitelist] = true;
  }

  /**
   * @notice set a new hedging reactor
   * @param _reactorAddress append a new hedging reactor 
   * @dev   only governance can call this function
   */
  function setHedgingReactorAddress(address _reactorAddress) onlyOwner public {
    hedgingReactors.push(_reactorAddress);
    SafeTransferLib.safeApprove(ERC20(strikeAsset), _reactorAddress, maxTotalSupply);

  }

  /**
   * @notice set new custom order parameters
   * @param _callMinDelta the minimum delta value a sold custom call option can have (e18 format - for 0.05 enter 5e16). Must be positive or 0.
   * @param _callMaxDelta the maximum delta value a sold custom call option can have. Must be positive and have greater magnitude than _callMinDelta.
   * @param _putMinDelta the minimum delta value a sold custom put option can have. Must be negative and have greater magnitude than _putMaxDelta
   * @param _putMaxDelta the maximum delta value a sold custom put option can have. Must be negative or 0.
   * @param _maxPriceRange the max percentage below the LP calculated premium that the order may be sold for. Measured in BPS - for 10% enter 1000
   */
  function setCustomOrderBounds (   
    uint128 _callMinDelta,
    uint128 _callMaxDelta,
    int128 _putMinDelta,
    int128 _putMaxDelta,
    uint32 _maxPriceRange
  ) onlyOwner public {
    customOrderBounds.callMinDelta = _callMinDelta;
    customOrderBounds.callMaxDelta = _callMaxDelta;
    customOrderBounds.putMinDelta = _putMinDelta;
    customOrderBounds.putMaxDelta = _putMaxDelta;
    customOrderBounds.maxPriceRange = _maxPriceRange;
  }

 /**
   * @notice remove a new hedging reactor by index
   * @param _index remove a hedging reactor 
   * @dev   only governance can call this function
   */
  function removeHedgingReactorAddress(uint256 _index) onlyOwner public {
    delete hedgingReactors[_index];
  }

  /**
   * @notice set the volatility skew of the pool
   * @param values the parameters of the skew
   * @param isPut the option type, put or call?
   * @return whether the activation was successful
   * @dev   only governance can call this function
   */
  function setVolatilitySkew(int[7] calldata values, bool isPut)
      onlyOwner
      external
      returns (bool)
  {
      if (!isPut) {
          callsVolatilitySkew = values;
      } else {
          putsVolatilitySkew = values;
      }
  }

  /**
   * @notice get the volatility skew of the pool
   * @param isPut the option type, put or call?
   * @return the skew parameters
   */
  function getVolatilitySkew(bool isPut)
      external
      view
      returns (int[7] memory)
  {
      if (!isPut) {
          return callsVolatilitySkew;
      } else {
          return putsVolatilitySkew;
      }
  }
  /**
    @notice set a new min strike price for calls
    @param _newPrice new min strike price - denominated in 1e18
  */
  function setMinCallStrikePrice(uint128 _newPrice) public onlyOwner {
    optionParams.minCallStrikePrice = _newPrice;
  }
  /**
    @notice set a new max strike price for calls
    @param _newPrice new max strike price - denominated in 1e18
  */
  function setMaxCallStrikePrice(uint128 _newPrice) public onlyOwner {
    optionParams.maxCallStrikePrice = _newPrice;
  }
  /**
    @notice set a new min strike price for puts
    @param _newPrice new min strike price - denominated in 1e18
  */
  function setMinPutStrikePrice(uint128 _newPrice) public onlyOwner {
    optionParams.minPutStrikePrice = _newPrice;
  }
  /**
    @notice set a new max strike price for puts
    @param _newPrice new max strike price - denominated in 1e18
  */
  function setMaxPutStrikePrice(uint128 _newPrice) public onlyOwner {
    optionParams.maxPutStrikePrice = _newPrice;
  }
  /**
    @notice set a new min expiry period
    @param _newPeriod new min expiry period - denominated in seconds * 1e18
  */
  function setMinExpiryPeriod(uint128 _newPeriod) public onlyOwner {
    optionParams.minExpiry = _newPeriod;
  }
  /**
    @notice set a new max expiry period
    @param _newPeriod new max expiry period - denominated in seconds * 1e18
  */
  function setMaxExpiryPeriod(uint128 _newPeriod) public onlyOwner {
    optionParams.maxExpiry = _newPeriod;
  }
   /**
    @notice update all optionParam variables
  */
  function setNewOptionParams(uint128 _newMinCallStrike,uint128 _newMaxCallStrike,uint128 _newMinPutStrike,uint128 _newMaxPutStrike,uint128 _newMinExpiry,uint128 _newMaxExpiry) public onlyOwner {
    optionParams.minCallStrikePrice = _newMinCallStrike;
    optionParams.maxCallStrikePrice = _newMaxCallStrike;
    optionParams.minPutStrikePrice = _newMinPutStrike;
    optionParams.maxPutStrikePrice = _newMaxPutStrike;
    optionParams.minExpiry = _newMinExpiry;
    optionParams.maxExpiry = _newMaxExpiry;
  }

  /**
   * @notice set the bid ask spread used to price option buying
   * @param _bidAskSpread the bid ask spread to update to
   */
  function setBidAskSpread(uint256 _bidAskSpread) external onlyOwner {
    bidAskIVSpread = _bidAskSpread;
  }

  /**
   * @notice set the cached options variables used to estimate portfolio delta
   * @param _totalAmountCall total amount of written calls
   * @param _totalAmountPut total amount of written puts
   * @param _weightedStrikeCall weighted average strike of written calls
   * @param _weightedTimeCall weighted average time to expiration of written calls
   * @param _weightedStrikePut weighted average strike of written puts
   * @param _weightedTimePut weighted average time to expiration of puts
   */
  function setCachedOptionsVariables(
    uint256 _totalAmountCall,
    uint256 _totalAmountPut,
    uint256 _weightedStrikeCall,
    uint256 _weightedTimeCall,
    uint256 _weightedStrikePut,
    uint256 _weightedTimePut
  ) external onlyOwner {
      totalAmountCall = _totalAmountCall;
      totalAmountPut = _totalAmountPut;
      weightedStrikeCall = _weightedStrikeCall;
      weightedTimeCall = _weightedTimeCall;
      weightedStrikePut = _weightedStrikePut;
      weightedTimePut = _weightedTimePut;
  }

  /**
   * @notice set the maximum percentage discount for an option
   * @param _maxDiscount of the option as a percentage in 1e18 format. ie: 1*e18 == 1%
   * @dev   only governance can call this function
   */
  function setMaxDiscount(uint256 _maxDiscount) external onlyOwner {
      maxDiscount = _maxDiscount;
  }

  /**
   * @notice set the maximum share supply of the pool
   * @param _maxTotalSupply of the shares
   * @dev   only governance can call this function
   */
  function setMaxTotalSupply(uint256 _maxTotalSupply) external onlyOwner {
      maxTotalSupply = _maxTotalSupply;
  }

  /**
   * @notice update the liquidity pool buffer limit
   * @param _bufferPercentage the minimum balance the liquidity pool must have as a percentage of total NAV. (for 20% enter 2000)
  */
  function setBufferPercentage(uint _bufferPercentage) external onlyOwner {
    bufferPercentage = _bufferPercentage;
  }

  /**
   * @notice function for adding liquidity to the options liquidity pool
   * @param _amount    amount of the strike asset to deposit
   * @param _recipient the recipient of the shares
   * @return shares amount of shares minted to the recipient
   * @dev    entry point to provide liquidity to dynamic hedging vault 
   */
  function deposit(
    uint _amount,
    address _recipient
    )
    external
    whenNotPaused()
    returns(uint shares)
  {
    if (_amount == 0) {revert InvalidAmount();}
    // Calculate shares to mint based on the amount provided
    (shares) = _sharesForAmount(_amount);
    if (shares == 0) {revert InvalidShareAmount();}
    // Pull in tokens from sender
    SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(this), _amount);
    // mint lp token to recipient
    _mint(_recipient, shares);
    emit Deposit(_recipient, _amount, shares);
    if (totalSupply > maxTotalSupply) {revert TotalSupplyReached();}
  }

  /**
   * @notice function for removing liquidity from the options liquidity pool
   * @param _shares    amount of shares to return
   * @param _recipient the recipient of the amount to return
   * @return transferCollateralAmount amount of strike asset to return to the recipient
   * @dev    entry point to remove liquidity to dynamic hedging vault 
   */
  function withdraw(
    uint _shares,
    address _recipient
  )
    external
    whenNotPaused()
    returns(uint transferCollateralAmount)
  {
    if (_shares == 0) {revert InvalidShareAmount();}
    // get the value of amount for the shares
    uint collateralAmount = _shareValue(_shares);
    // calculate max amount of liquidity pool funds that can be used before reaching max buffer allowance
    (uint256 normalizedCollateralBalance,, uint256 _decimals) = getNormalizedBalance(collateralAsset);
    // Calculate liquidity that can be withdrawn without hitting buffer
    int256 bufferRemaining = int256(normalizedCollateralBalance) - int(_getNAV() * bufferPercentage/MAX_BPS);
    // determine if any extra liquidity is needed. If this value is 0 or less, withdrawal can happen with no further action
    int256 amountNeeded = int(collateralAmount) - bufferRemaining;
    if (amountNeeded > 0) {
      // if above zero, we need to withdraw funds from hedging reactors
      ///TODO create some kind of hierachical preference for which reactor to withdraw from first? (close positions that are costing us first)
      for (uint8 i=0; i < hedgingReactors.length; i++) {
        amountNeeded -= int(IHedgingReactor(hedgingReactors[i]).withdraw(uint(amountNeeded), collateralAsset));
        if (amountNeeded <= 0) {
          break;
        }
      }
      // if still above zero after withdrawing from hedging reactors, we do not have enough liquidity
      if (amountNeeded > 0) { revert WithdrawExceedsLiquidity();}
    }
    transferCollateralAmount = OptionsCompute.convertToDecimals(collateralAmount, _decimals);
    // burn the shares
    _burn(msg.sender, _shares);
    // send funds to user
    SafeTransferLib.safeTransfer(ERC20(collateralAsset), _recipient, transferCollateralAmount);
    //TODO implement book balance reconcilation check
    emit Withdraw(_recipient, _shares, transferCollateralAmount);
  }

  /**
   * @notice Returning balance in 1e18 format
   * @param asset address of the asset to get balance and normalize
   * @return normalizedBalance balance in 1e18 format
   * @return collateralBalance balance in original decimal format
   * @return _decimals decimals of asset
   */
   function getNormalizedBalance(
    address asset
  )
    internal
    view
    returns (uint256 normalizedBalance, uint256 collateralBalance, uint256 _decimals) 
  {
    collateralBalance = IERC20(asset).balanceOf(address(this));
    _decimals = IERC20(asset).decimals();
    normalizedBalance = OptionsCompute.convertFromDecimals(collateralBalance, _decimals);
  }

  /**
   * @notice value of all puts written by the pool
   * @return value of all puts denominated in the collateralAsset
   */
  function _valuePutsWritten()
      internal
      view
      returns (uint)
  {
      if (weightedStrikePut == 0) return uint(0);
      uint underlyingPrice = getUnderlyingPrice(underlyingAsset, strikeAsset);
      // TODO Consider using VAR (value at risk) approach in the future
      uint iv = getImpliedVolatility(true, underlyingPrice, weightedStrikePut, weightedTimePut);
      uint optionPrice = BlackScholes.blackScholesCalc(
         underlyingPrice,
         weightedStrikePut,
         weightedTimePut,
         iv,
         riskFreeRate,
         true
      );
      return totalAmountPut.mul(optionPrice);      
  }

  /**
   * @notice value of all calls written by the pool
   * @return value of all calls denominated in the underlying
   */
  function _valueCallsWritten()
      internal
      view
      returns (uint)
  {
      if (weightedStrikeCall == 0) return uint(0);
      uint underlyingPrice = getUnderlyingPrice(underlyingAsset, strikeAsset);
      uint iv = getImpliedVolatility(false, underlyingPrice, weightedStrikeCall, weightedTimeCall);
      uint optionPrice = BlackScholes.blackScholesCalc(
        underlyingPrice,
        weightedStrikePut,
        weightedTimePut,
        iv,
        riskFreeRate,
        false
      );     
      uint callsValue = totalAmountCall.mul(uint256(optionPrice));
      return callsValue;
  }

  /**
   * @notice get the number of shares for a given amount
   * @param _amount  the amount to convert to shares
   * @return shares the number of shares based on the amount
   */
  function _sharesForAmount(uint _amount)
    internal
    view
    returns
    (uint shares)
  {
    // equities = assets - liabilities
    // assets: Any token such as eth usd, collateral sent to OptionRegistry, hedging reactor stuff
    // liabilities: Options that we wrote 
    uint256 convertedAmount = OptionsCompute.convertFromDecimals(_amount, IERC20(collateralAsset).decimals());
    if (totalSupply == 0) {
      shares = convertedAmount;
    } else {
      uint NAV = _getNAV();
      shares = convertedAmount.mul(totalSupply).div(NAV);
    }
  }

  /**
   * @notice get the Net Asset Value
   * @return Net Asset Value in e18 decimal format
   */
  function _getNAV()
    internal
    view
    returns (uint)
  {
    // equities = assets - liabilities
    // assets: Any token such as eth usd, collateral sent to OptionRegistry, hedging reactor stuff
    // liabilities: Options that we wrote 
    uint256 assets = OptionsCompute.convertFromDecimals(IERC20(collateralAsset).balanceOf(address(this)), IERC20(collateralAsset).decimals()) + OptionsCompute.convertFromDecimals(collateralAllocated, IERC20(collateralAsset).decimals());
    for (uint8 i=0; i < hedgingReactors.length; i++) {
       assets += IHedgingReactor(hedgingReactors[i]).getPoolDenominatedValue();
    }
    uint256 liabilities = _valueCallsWritten() + _valuePutsWritten();
    uint256 NAV = assets - liabilities;
    return NAV;
  }

  /**
   * @notice get the amount for a given number of shares
   * @param _shares  the shares to convert to amount
   * @return amount the number of amount based on shares
   */
  function _shareValue(uint _shares)
    internal
    view
    returns (uint amount)
  {
    if (totalSupply == 0) {
      amount = _shares;
    } else {
      uint256 NAV = _getNAV();
      amount = _shares.mul(NAV).div(totalSupply);
    }

  }


  /**
   * @notice get the price feed used by the liquidity pool
   * @return the price feed contract interface
   */
  function getPriceFeed() internal view returns (PriceFeed) {
    address feedAddress = Protocol(protocol).priceFeed();
    return PriceFeed(feedAddress);
  }

  /**
   * @notice get the option registry used for storing and managing the options
   * @return the option registry contract interface
   */
  function getOptionRegistry() internal view returns (OptionRegistry) {
    address registryAddress = Protocol(protocol).optionRegistry();
    return OptionRegistry(registryAddress);
  }

  /**
   * @notice get the underlying price with just the optionSeries
   * @param optionSeries the option series to check the underlying price for
   * @return the underlying price
   */
  function getUnderlyingPrice(
    Types.OptionSeries memory optionSeries
  )
    internal
    view
    returns (uint)
  {
    return getUnderlyingPrice(optionSeries.underlying, optionSeries.strikeAsset);
  }

  /**
   * @notice get the underlying price with just the underlying asset and strike asset
   * @param underlying   the asset that is used as the reference asset
   * @param _strikeAsset the asset that the underlying value is denominated in
   * @return the underlying price
   */
  function getUnderlyingPrice(
    address underlying,
    address _strikeAsset
  )
      internal
      view
      returns (uint)
  {
      PriceFeed priceFeed = getPriceFeed();
      uint underlyingPrice = priceFeed.getNormalizedRate(
        underlying,
        _strikeAsset
     );
      return underlyingPrice;
  }

  /**
   * @notice get the current implied volatility 
   * @param isPut Is the option a call or put?
   * @param underlyingPrice The underlying price 
   * @param strikePrice The strike price of the option
   * @param expiration expiration timestamp of option as a PRBMath Float
   * @return Implied volatility adjusted for volatility surface
   */
  function getImpliedVolatility(
    bool isPut,
    uint underlyingPrice,
    uint strikePrice,
    uint expiration
  )
    public
    view
    returns (uint) 
    {
      uint256 time = (expiration - block.timestamp).div(ONE_YEAR_SECONDS);
      int underlying = int(underlyingPrice);
      int spot_distance = (int(strikePrice) - int(underlying)).div(underlying);
      int[2] memory points = [spot_distance, int(time)];
      int[7] memory coef = isPut ? putsVolatilitySkew : callsVolatilitySkew;
      return uint(OptionsCompute.computeIVFromSkew(coef, points));
    }

  /**
   * @notice get the greeks of a quotePrice for a given optionSeries
   * @param  optionSeries Types.OptionSeries struct for describing the option to price greeks
   * @return quote           Quote price of the option
   * @return delta           delta of the option being priced
   * @return underlyingPrice price of the underlyingAsset
   */
  function quotePriceGreeks(
     Types.OptionSeries memory optionSeries,
     bool isBuying
  )
      internal
      view
      returns (uint256 quote, int256 delta, uint256 underlyingPrice)
  {
      underlyingPrice = getUnderlyingPrice(optionSeries);
      uint iv = getImpliedVolatility(optionSeries.isPut, underlyingPrice, optionSeries.strike, optionSeries.expiration);
      if (iv == 0) {revert IVNotFound();}
      if (isBuying) {
        iv = iv - bidAskIVSpread;
      }
      // revert if the expiry is in the past
      if (optionSeries.expiration <= block.timestamp) {revert OptionExpiryInvalid();}
      (quote, delta) = BlackScholes.blackScholesCalcGreeks(
       underlyingPrice,
       optionSeries.strike,
       optionSeries.expiration,
       iv,
       riskFreeRate,
       optionSeries.isPut
      );
  }

  /**
   * @notice get the delta of the portfolio
   * @return portfolio delta
   */
  function getPortfolioDelta()
      public
      view
      returns (int256)
  {
      uint256 price = getUnderlyingPrice(underlyingAsset, strikeAsset);
      uint256 rfr = riskFreeRate;
      int256 callsDelta;
      int256 putsDelta;
      if (weightedTimeCall != 0) {
        uint256 callIv = getImpliedVolatility(false, price, weightedStrikeCall, weightedTimeCall);
        callsDelta = BlackScholes.getDelta(
          price,
          weightedStrikeCall,
          weightedTimeCall,
          callIv,
          rfr,
          false
        );
      }
      if (weightedTimePut != 0) {
        uint256 putIv = getImpliedVolatility(true, price, weightedStrikePut, weightedTimePut);
        putsDelta = BlackScholes.getDelta(
           price,
           weightedStrikePut,
           weightedTimePut,
           putIv,
           rfr,
           true
        );
      }
      int256 externalDelta;
      // TODO fix hedging reactor address to be dynamic
      for (uint8 i=0; i < hedgingReactors.length; i++) {
        externalDelta += IHedgingReactor(hedgingReactors[i]).getDelta();
      }
      // return the negative sum of open option because we are the counterparty
      return -(callsDelta*int256(totalAmountCall)/int256(PRBMath.SCALE) + putsDelta*int256(totalAmountPut)/int256(PRBMath.SCALE)) + externalDelta;
  }
    
  /**
   * @notice function to return absolute value of an input
   * @param  x value to check
   * @return absolute value to return
   */
  function abs(int256 x) private pure returns (int256) {
    return x >= 0 ? x : -x;
}

  /**
  @notice function for hedging portfolio delta through external means
  @param delta the current portfolio delta
   */
  function rebalancePortfolioDelta(int256 delta, uint256 reactorIndex)
    public onlyRole(ADMIN_ROLE) whenNotPaused()
  { 
      if(abs(delta) > dustValue) {
      // TODO check to see if we can be paid to open a position using derivatives using funding rate
        IHedgingReactor(hedgingReactors[reactorIndex]).hedgeDelta(delta);
      }
      // TODO if we dont / not enough - look at derivatives
  }

  struct UtilizationState {
    uint optionPrice;
    uint utilizationPrice;
    bool isDecreased;
    uint deltaTiltFactor;
  }

  /**
   * @notice get the quote price and delta for a given option
   * @param  optionSeries option type to quote
   * @param  amount the number of options to mint 
   * @return quote the price of the options
   * @return delta the delta of the options
   */
  function quotePriceWithUtilizationGreeks(
    Types.OptionSeries memory optionSeries,
    uint amount
  )
      public
      view
      returns (uint256 quote, int256 delta)
  {
      (uint256 optionQuote,  int256 deltaQuote, uint underlyingPrice) = quotePriceGreeks(optionSeries, false);
      // using a struct to get around stack too deep issues
      UtilizationState memory quoteState;
      // price of acquiring those options
      quoteState.optionPrice = optionQuote.mul(amount);
      int portfolioDelta = getPortfolioDelta();
      // portfolio delta upon writing option
      int newDelta = PRBMathSD59x18.abs(portfolioDelta + deltaQuote);
      // assumes a single collateral type regardless of call or put
      // @TODO change this to use collateral lockup required / available liquidity
      uint utilization = quoteState.optionPrice.div(totalSupply);
      // Is delta decreased?
      quoteState.isDecreased = newDelta < PRBMathSD59x18.abs(portfolioDelta);
      // delta in non-nominal terms
      uint normalizedDelta = uint256(newDelta).div(_getNAV());
      // max theoretical price of the option
      uint maxPrice = optionSeries.isPut ? optionSeries.strike : underlyingPrice;
      quoteState.utilizationPrice = maxPrice.mul(utilization);
      // layered on to BlackScholes price when delta is moved away from target
      quoteState.deltaTiltFactor = (maxPrice.mul(normalizedDelta)).div(quoteState.optionPrice);
      if (quoteState.isDecreased) {
        // provide discount for moving towards delta zero
        uint discount = quoteState.deltaTiltFactor > maxDiscount ? maxDiscount : quoteState.deltaTiltFactor;
        // discounted BS option price
        uint newOptionPrice = quoteState.optionPrice - discount.mul(quoteState.optionPrice);
        // discounted utilization priced option
        quoteState.utilizationPrice = quoteState.utilizationPrice - discount.mul(quoteState.utilizationPrice);
        // quote the greater of discounted utilization or discounted BS
        quote = quoteState.utilizationPrice > newOptionPrice ? quoteState.utilizationPrice : newOptionPrice;
      } else {
        uint newOptionPrice = quoteState.deltaTiltFactor.mul(quoteState.optionPrice) + quoteState.optionPrice;
        if (quoteState.utilizationPrice < maxPrice) {
          // increase utilization by delta tilt factor for moving delta away from zero
          quoteState.utilizationPrice = quoteState.deltaTiltFactor.mul(quoteState.utilizationPrice) + quoteState.utilizationPrice;
          quote = quoteState.utilizationPrice > newOptionPrice ? quoteState.utilizationPrice : newOptionPrice;
        } else {
          quote = maxPrice;
        }
      }
      quote =  OptionsCompute.convertToCollateralDenominated(quote, underlyingPrice, optionSeries);
      delta = deltaQuote;
      //@TODO think about more robust considitions for this check
      if (quote == 0 || delta == int(0)) { revert DeltaQuoteError(quote, delta);}
  }

  /**
   * @notice get the quote price and delta for a given option
   * @param  optionSeries option type to quote
   * @param  amount the number of options to buy 
   * @return quote the price of the options
   * @return delta the delta of the options
   */
  function quotePriceBuying(
    Types.OptionSeries memory optionSeries,
    uint amount
  )
      public
      view
      returns (uint256 quote, int256 delta)
  {
      (uint256 optionQuote,  int256 deltaQuote, uint underlyingPrice) = quotePriceGreeks(optionSeries, true);
      quote = optionQuote.mul(amount);
      delta = deltaQuote;
      quote =  OptionsCompute.convertToCollateralDenominated(quote, underlyingPrice, optionSeries);
      //@TODO think about more robust considitions for this check
      if (quote == 0 || delta == int(0)) { revert DeltaQuoteError(quote, delta); }
  }

  /**
   * @notice calculates amount of liquidity that can be used before hitting buffer
   * @return bufferRemaining the amount of liquidity available before reaching buffer
  */
  function _checkBuffer() view internal returns(int256 bufferRemaining){ 
      // calculate max amount of liquidity pool funds that can be used before reaching max buffer allowance
    (uint256 normalizedCollateralBalance,,) = getNormalizedBalance(collateralAsset);
    bufferRemaining = int256(normalizedCollateralBalance - _getNAV() * bufferPercentage/MAX_BPS);
    // revert if buffer allowance already hit
    if(bufferRemaining <= 0) {revert MaxLiquidityBufferReached();}
    return bufferRemaining;
  }

  /**
   * @notice write a number of options for a given series addres
   * @param  optionSeries option type to mint
   * @param  amount       the number of options to mint 
   * @return optionAmount the number of options minted
   * @return series       the address of the option series minted
   */
  function issueAndWriteOption(
     Types.OptionSeries memory optionSeries,
     uint amount
  ) 
    public
    whenNotPaused()
    returns (uint optionAmount, address series)
  {
    int256 bufferRemaining = _checkBuffer();
    OptionRegistry optionRegistry = getOptionRegistry();
    series = _issue(optionSeries, optionRegistry);
    // calculate premium
    (uint256 premium,) = quotePriceWithUtilizationGreeks(optionSeries, amount);
    // premium needs to adjusted for decimals of collateral asset
    SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(this), OptionsCompute.convertToDecimals(premium, IERC20(collateralAsset).decimals()));
    //write the option
    optionAmount = _writeOption(optionSeries, series, amount, optionRegistry, premium, bufferRemaining);
  }

  /**
   * @notice write a number of options for a given series address
   * @param  seriesAddress the option token series address
   * @param  amount        the number of options to mint expressed as 1e18  
   * @return number of options minted
   */
  function writeOption(
    address seriesAddress,
    uint amount
  )
    public
    whenNotPaused()
    returns (uint256)
  {
    int256 bufferRemaining = _checkBuffer();
    OptionRegistry optionRegistry = getOptionRegistry();
    // get the option series from the pool
    Types.OptionSeries memory optionSeries = optionRegistry.getSeriesInfo(seriesAddress);
    // calculate premium
    (uint256 premium,) = quotePriceWithUtilizationGreeks(optionSeries, amount);
    // premium needs to adjusted for decimals of collateral asset
    SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(this), OptionsCompute.convertToDecimals(premium, IERC20(collateralAsset).decimals()));
    return _writeOption(optionSeries, seriesAddress, amount, optionRegistry, premium, bufferRemaining);
  }

  /**
   * @notice create the option contract in the options registry
   * @param  optionSeries option type to mint
   * @param  optionRegistry interface for the options issuer
   * @return series       the address of the option series minted
   */
  function _issue(Types.OptionSeries memory optionSeries, OptionRegistry optionRegistry) internal returns (address series) {
    // check the expiry is within the allowed bounds
    if (block.timestamp + optionParams.minExpiry > optionSeries.expiration || optionSeries.expiration > block.timestamp + optionParams.maxExpiry) {revert OptionExpiryInvalid();}
    // check that the option strike is within the range of the min and max acceptable strikes of calls and puts
    if(optionSeries.isPut){
      if (optionParams.minPutStrikePrice > optionSeries.strike || optionSeries.strike > optionParams.maxPutStrikePrice) {revert OptionStrikeInvalid();}
    } else {
      if (optionParams.minCallStrikePrice > optionSeries.strike || optionSeries.strike > optionParams.maxCallStrikePrice) {revert OptionStrikeInvalid();}
    }
    // make sure the collateral of the option is the same as the collateral asset of the pool
    if (optionSeries.collateral != collateralAsset) {revert CollateralAssetInvalid();}
    // make sure the strike asset of the option is the same as the strike asset of the pool
    if (optionSeries.strikeAsset != strikeAsset) {revert StrikeAssetInvalid();}
    // make sure the underlying of the option is the same as the underlying of the pool
    if (optionSeries.underlying != underlyingAsset) {revert UnderlyingAssetInvalid();}
    // issue the option from the option registry (its characteristics will be stored in the optionsRegistry)
    series = optionRegistry.issue(
       optionSeries.underlying,
       optionSeries.strikeAsset,
       optionSeries.expiration,
       optionSeries.isPut,
       optionSeries.strike,
       collateralAsset
    );
    if (series == address(0)) {revert IssuanceFailed();}
  }

  /**
   * @notice write a number of options for a given OptionSeries
   * @param  optionSeries option type to mint
   * @param  seriesAddress the address of the options series
   * @param  amount the amount to be written
   * @param  optionRegistry the option registry of the pool
   * @param  premium the premium to charge the user
   * @return the amount that was written
   */
  function _writeOption(Types.OptionSeries memory optionSeries, address seriesAddress, uint256 amount, OptionRegistry optionRegistry, uint256 premium, int256 bufferRemaining) internal returns (uint256) {
    uint256 collateralAmount = optionRegistry.getCollateral(Types.OptionSeries( 
       optionSeries.expiration,
       optionSeries.isPut,
       optionSeries.strike/(10**10), // convert from 1e18 to 1e8 notation for getCollateral()
       optionSeries.underlying,
       optionSeries.strikeAsset,
       collateralAsset), amount);

    if (uint(bufferRemaining) < OptionsCompute.convertFromDecimals(collateralAmount, IERC20(collateralAsset).decimals())) {revert MaxLiquidityBufferReached();}
    IERC20(collateralAsset).approve(address(optionRegistry), collateralAmount);
    (, collateralAmount) = optionRegistry.open(seriesAddress, amount, collateralAmount);
    emit WriteOption(seriesAddress, amount, premium, collateralAmount, msg.sender);
    _adjustWeightedVariables(optionSeries, amount, collateralAmount, true);
    SafeTransferLib.safeTransfer(ERC20(seriesAddress), msg.sender, OptionsCompute.convertToDecimals(amount, IERC20(seriesAddress).decimals()));
    return amount;
  }

  /**
   * @notice adjust the weighted variables of the pool
   * @param  optionSeries option type to mint
   * @param  amount the amount to be written
   */
  function _adjustWeightedVariables(Types.OptionSeries memory optionSeries, uint256 amount, uint256 collateralAmount, bool isSale) internal {

    if (!optionSeries.isPut) {
        (uint newTotal, uint newWeight, uint newTime) = OptionsCompute.computeNewWeights(
            amount, optionSeries.strike, optionSeries.expiration, totalAmountCall, weightedStrikeCall, weightedTimeCall, isSale );
        totalAmountCall = newTotal;
        weightedStrikeCall = newWeight;
        weightedTimeCall = newTime;
        if (isSale) {
          // TODO: make sure this is ok with collateral types
          collateralAllocated += collateralAmount;
        } else {
          collateralAllocated -= collateralAmount;
        }
    } else {
        (uint newTotal, uint newWeight, uint newTime) = OptionsCompute.computeNewWeights(
            amount, optionSeries.strike, optionSeries.expiration, totalAmountPut, weightedStrikePut, weightedTimePut, isSale);
        totalAmountPut = newTotal;
        weightedStrikePut = newWeight;
        weightedTimePut = newTime;
        if (isSale) {
          // TODO: make sure this is ok with collateral types
          collateralAllocated += collateralAmount;
        } else {
          collateralAllocated -= collateralAmount;
        }
    }
  }
  
  /**
    @notice buys a number of options back and burns the tokens
    @param optionSeries the option token series to buyback
    @param amount the number of options to buyback expressed in 1e18
    @return the number of options bought and burned
  */
  function buybackOption(
    Types.OptionSeries memory optionSeries,
    uint amount
  ) public nonReentrant whenNotPaused() returns (uint256){
    // revert if the expiry is in the past
    if (optionSeries.expiration <= block.timestamp) {revert OptionExpiryInvalid();}
    (uint256 premium, int256 delta) = quotePriceBuying(optionSeries, amount);
    if (!buybackWhitelist[msg.sender]){
      int portfolioDelta = getPortfolioDelta();
      int newDelta = PRBMathSD59x18.abs(portfolioDelta + delta);
      bool isDecreased = newDelta < PRBMathSD59x18.abs(portfolioDelta);
      if (!isDecreased) {revert DeltaNotDecreased();}
    }
    OptionRegistry optionRegistry = getOptionRegistry();  
    address seriesAddress = optionRegistry.getOtoken(
       optionSeries.underlying,
       optionSeries.strikeAsset,
       optionSeries.expiration,
       optionSeries.isPut,
       optionSeries.strike,
       collateralAsset
    );     
    if (seriesAddress == address(0)) {revert NonExistentOtoken();} 
    SafeTransferLib.safeApprove(ERC20(seriesAddress), address(optionRegistry), OptionsCompute.convertToDecimals(amount, IERC20(seriesAddress).decimals()));
    SafeTransferLib.safeTransferFrom(seriesAddress, msg.sender, address(this), OptionsCompute.convertToDecimals(amount, IERC20(seriesAddress).decimals()));
  
    (, uint collateralReturned) = optionRegistry.close(seriesAddress, amount);
    emit BuybackOption(seriesAddress, amount, premium, collateralReturned, msg.sender);
    _adjustWeightedVariables(optionSeries, amount, collateralReturned, false);
    SafeTransferLib.safeTransfer(ERC20(collateralAsset), msg.sender, OptionsCompute.convertToDecimals(premium, IERC20(collateralAsset).decimals()));
    return amount;
  }

  /**
    @notice creates an order for a number of options from the pool to a specified user. The function
            is intended to be used to issue options to market makers/ OTC market participants
            in order to have flexibility and customisability on option issuance and market 
            participant UX.
    @param _optionSeries the option token series to issue
    @param _amount the number of options to issue 
    @param _price the price per unit to issue at
    @param _orderExpiry the expiry of the order (if past the order is redundant)
    @param _buyerAddress the agreed upon buyer address
    @return orderId the unique id of the order
  */
  function createOrder(
    Types.OptionSeries memory _optionSeries, 
    uint256 _amount, 
    uint256 _price, 
    uint256 _orderExpiry,
    address _buyerAddress
  ) public onlyRole(ADMIN_ROLE) returns (uint) 
  {
    OptionRegistry optionRegistry = getOptionRegistry();
    if (_price == 0) {revert InvalidPrice();}
    if (_orderExpiry == 0) {revert OrderExpired();}
    // issue the option type, all checks of the option validity should happen in _issue
    address series = _issue(_optionSeries, optionRegistry);
    // create the order struct, setting the series, amount, price, order expiry and buyer address
    Types.Order memory order = Types.Order(
      _optionSeries,
      _amount,
      _price,
      block.timestamp + _orderExpiry,
      _buyerAddress,
      series
    );
    uint orderIdCounter__ = orderIdCounter + 1;
    // increment the orderId and store the order
    orderStores[orderIdCounter__] = order;
    emit OrderCreated(orderIdCounter__);
    orderIdCounter = orderIdCounter__;
    return orderIdCounter__;
  }

  /** 
    @notice creates a strangle order. One custom put and one custom call order to be executed simultaneously.
    @param _optionSeriesCall the option token series to issue for the call part of the strangle
    @param _optionSeriesPut the option token series to issue for the put part of the strangle
    @param _amountCall the number of call options to issue 
    @param _amountPut the number of put options to issue 
    @param _priceCall the price per unit to issue calls at
    @param _pricePut the price per unit to issue puts at
    @param _orderExpiry the expiry of the order (if past the order is redundant)
    @param _buyerAddress the agreed upon buyer address
    @return strangleIdCounter the unique id of the strangle
  */
  function createStrangle(
    Types.OptionSeries memory _optionSeriesCall, 
    Types.OptionSeries memory _optionSeriesPut, 
    uint256 _amountCall,
    uint256 _amountPut, 
    uint256 _priceCall,
    uint256 _pricePut,
    uint256 _orderExpiry,
    address _buyerAddress
  ) external onlyRole(ADMIN_ROLE) returns (uint) 
  {
    // increment strangleId to store strangle order pair
    uint strangleIdCounter__ = strangleIdCounter + 1;
    // issue the call order part of the strangle
    uint callOrderId = createOrder(_optionSeriesCall, _amountCall, _priceCall, _orderExpiry, _buyerAddress);
    strangleOrderPairs[strangleIdCounter__][0] = callOrderId;
    uint putOrderId = createOrder(_optionSeriesPut, _amountPut, _pricePut, _orderExpiry, _buyerAddress);
    strangleOrderPairs[strangleIdCounter__][1] = putOrderId;
    emit StrangleCreated(strangleIdCounter__);
    strangleIdCounter = strangleIdCounter__;
    return strangleIdCounter__;
  }

  /**
    @notice fulfills an order for a number of options from the pool to a specified user. The function
            is intended to be used to issue options to market makers/ OTC market participants
            in order to have flexibility and customisability on option issuance and market 
            participant UX.
    @param  _orderId the id of the order for options purchase
    @param  _isStrangle if this order is part of a strangle order 
  */
  function executeOrder(uint256 _orderId, bool _isStrangle) public nonReentrant {
    int256 bufferRemaining = _checkBuffer();
    // get the order
    Types.Order memory order = orderStores[_orderId];
    // check that the sender is the authorised buyer of the order
    if(msg.sender != order.buyer) {revert InvalidBuyer();}
    // check that the order is still valid
    if(block.timestamp > order.orderExpiry) {revert OrderExpired();}
    OptionRegistry optionRegistry = getOptionRegistry();  
    Types.OptionSeries memory optionSeries = optionRegistry.getSeriesInfo(order.seriesAddress);
    (uint poolCalculatedPremium, int delta) = quotePriceWithUtilizationGreeks(Types.OptionSeries( 
       optionSeries.expiration,
       optionSeries.isPut,
       OptionsCompute.convertFromDecimals(optionSeries.strike, ERC20(order.seriesAddress).decimals()), // convert from 1e8 to 1e18 notation for quotePrice
       optionSeries.underlying,
       optionSeries.strikeAsset,
       collateralAsset), order.amount);
    
    // calculate the total premium
    uint256 premium = (order.amount * order.price) / 1e18;
    // check the agreed upon premium is within acceptable range of pool's own pricing model
    if (poolCalculatedPremium - (poolCalculatedPremium *  customOrderBounds.maxPriceRange / MAX_BPS) > premium) { revert CustomOrderInsufficientPrice(); }
    // check that the delta values of the options are within acceptable ranges
    // if isPut, delta will always be between 0 and -1e18
    if(optionSeries.isPut){
      if (customOrderBounds.putMinDelta > delta || delta > customOrderBounds.putMaxDelta) { revert CustomOrderInvalidDeltaValue(); }
    }
    // if call, delta will always be between 0 and 1e18
    if(!optionSeries.isPut){
       if (customOrderBounds.callMinDelta > uint(delta) || uint(delta) > customOrderBounds.callMaxDelta) { revert CustomOrderInvalidDeltaValue(); }
    }
    // premium needs to adjusted for decimals of collateral asset
    SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(this), OptionsCompute.convertToDecimals(premium, IERC20(collateralAsset).decimals()));
    // write the option contract, includes sending the premium from the user to the pool
    uint256 written = _writeOption(order.optionSeries, order.seriesAddress, order.amount, optionRegistry, premium, bufferRemaining);
    // invalidate the order
    delete orderStores[_orderId];
  }

  /**
    @notice fulfills a stored strangle order consisting of a stores call and a stored put.
    This is intended to be called by market makers/OTC market participants.
    @param _strangleId the id of the strangle order to fulfil 
  */
  function executeStrangle(uint256 _strangleId) external {

    executeOrder(strangleOrderPairs[_strangleId][0], true);
    executeOrder(strangleOrderPairs[_strangleId][1], true);
  }

  /**
    @notice closes an oToken vault, returning collateral (minus ITM option expiry value) back to the pool
    @param seriesAddress the address of the oToken vault to close
    @return collatReturned the amount of collateral returned to the liquidity pool.
  */
  function settleVault(address seriesAddress) public onlyRole(ADMIN_ROLE) returns (uint256 collatReturned) {
    OptionRegistry optionRegistry = getOptionRegistry();  
    // get number of options in vault and collateral returned to recalculate our position without these options
    (, uint256 collatReturned, uint256 collatLost, uint256 oTokensAmount) = optionRegistry.settle(seriesAddress);
    emit SettleVault(seriesAddress, collatReturned, collatLost, msg.sender);
    Types.OptionSeries memory optionSeries = optionRegistry.getSeriesInfo(seriesAddress);
    // recalculate liquidity pool's position
    _adjustWeightedVariables(optionSeries, oTokensAmount, collatReturned, false);
    collateralAllocated -= collatLost;

   }

  /**
    @notice adjust the collateral held in a specific vault because of health
    @param lpCollateralDifference amount of collateral taken from or given to the liquidity pool
    @param addToLpBalance true if collateral is returned to liquidity pool, false if collateral is withdrawn from liquidity pool
  */
  function adjustCollateral(uint256 lpCollateralDifference, bool addToLpBalance) external  {
    OptionRegistry optionRegistry = getOptionRegistry();
    require(msg.sender == address(optionRegistry));
    if(addToLpBalance){
      collateralAllocated -= lpCollateralDifference;
    } else {
      SafeTransferLib.safeApprove(ERC20(collateralAsset), address(optionRegistry), lpCollateralDifference);
      collateralAllocated += lpCollateralDifference;
    }
  }
}
