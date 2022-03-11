pragma solidity >=0.8.0;

import "./PriceFeed.sol";
import "./tokens/ERC20.sol";
import "./OptionRegistry.sol";
import "./OptionsProtocol.sol";
import "./utils/access/Ownable.sol";
import "./utils/ReentrancyGuard.sol";
import "./libraries/BlackScholes.sol";
import "./interfaces/IHedgingReactor.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import { Constants } from "./libraries/Constants.sol";
import { OptionsCompute } from "./libraries/OptionsCompute.sol";
import { SafeTransferLib } from "./libraries/SafeTransferLib.sol";

import "hardhat/console.sol";

error MinStrikeAmountExceedsLiquidity(uint256 strikeAmount, uint256 strikeAmountMin);
error MinUnderlyingAmountExceedsLiquidity(uint256 underlyingAmount, uint256 underlyingAmountMin);
error StrikeAmountExceedsLiquidity(uint256 strikeAmount, uint256 strikeLiquidity);
error UnderlyingAmountExceedsLiquidity(uint256 underlyingAmount, uint256 underlyingLiquidity);
error DeltaQuoteError(uint256 quote, int256 delta);

contract LiquidityPool is
  ERC20,
  Ownable,
  ReentrancyGuard
{
  using PRBMathSD59x18 for int256;
  using PRBMathUD60x18 for uint256;

  uint256 private constant ONE_YEAR_SECONDS = 31557600000000000000000000;
  // standard expected decimals of ERC20s
  uint8 private constant SCALE_DECIMALS = 18;
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

  event LiquidityAdded(uint amount);
  event UnderlyingAdded(address underlying);
  event ImpliedVolatilityUpdated(address underlying, uint iv);
  event Deposit(address recipient, uint strikeAmount, uint shares);
  event Withdraw(address recipient, uint shares,  uint strikeAmount);
  event WriteOption(address series, uint amount, uint premium, uint escrow, address buyer);
  event BuybackOption(address series, uint amount, uint premium, uint escrowReturned, address seller);


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
    OptionParams memory _optionParams
  ) ERC20(name, symbol, 18) 
  {
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
    @param _newPrice new min strike price - denominatd in 1e18
  */
  function setMinCallStrikePrice(uint128 _newPrice) public onlyOwner {
    optionParams.minCallStrikePrice = _newPrice;
  }
  /**
    @notice set a new max strike price for calls
    @param _newPrice new max strike price - denominatd in 1e18
  */
  function setMaxCallStrikePrice(uint128 _newPrice) public onlyOwner {
    optionParams.maxCallStrikePrice = _newPrice;
  }
  /**
    @notice set a new min strike price for puts
    @param _newPrice new min strike price - denominatd in 1e18
  */
  function setMinPutStrikePrice(uint128 _newPrice) public onlyOwner {
    optionParams.minPutStrikePrice = _newPrice;
  }
  /**
    @notice set a new max strike price for puts
    @param _newPrice new max strike price - denominatd in 1e18
  */
  function setMaxPutStrikePrice(uint128 _newPrice) public onlyOwner {
    optionParams.maxPutStrikePrice = _newPrice;
  }
  /**
    @notice set a new min expiry period
    @param _newPeriod new min expiry period - denominatd in seconds * 1e18
  */
  function setMinExpiryPeriod(uint128 _newPeriod) public onlyOwner {
    optionParams.minExpiry = _newPeriod;
  }
  /**
    @notice set a new max expiry period
    @param _newPeriod new max expiry period - denominatd in seconds * 1e18
  */
  function setMaxExpiryPeriod(uint128 _newPeriod) public onlyOwner {
    optionParams.maxExpiry = _newPeriod;
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
    returns(uint shares)
  {
    require(_amount > 0, "!_amount");
    // Calculate shares to mint based on the amount provided
    (shares) = _sharesForAmount(_amount);
    require(shares > 0, "!shares");
    // Pull in tokens from sender
    SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(this), _amount);
    // mint lp token to recipient
    _mint(_recipient, shares);
    emit Deposit(_recipient, _amount, shares);
    require(totalSupply <= maxTotalSupply, "maxTotalSupply");
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
    returns(uint transferCollateralAmount)
  {
    require(_shares > 0, "!shares");
    // get the value of amount for the shares
    uint collateralAmount = _shareValue(_shares);
    // determine if there is enough in the pool to withdraw
    // Calculate liquidity that can be withdrawn
    (uint256 normalizedCollateralBalance,, uint256 _decimals) = getNormalizedBalance(collateralAsset);               
    if (collateralAmount > normalizedCollateralBalance) {
      uint256 amountNeeded = collateralAmount - normalizedCollateralBalance;

      for (uint8 i=0; i < hedgingReactors.length; i++) {
        amountNeeded -= IHedgingReactor(hedgingReactors[i]).withdraw(amountNeeded, collateralAsset);
        if (amountNeeded == 0) {
          break;
        }
      }
      // Calculate liquidity that can be withdrawn again after an attempt has been made to free funds
      (normalizedCollateralBalance,, _decimals) = getNormalizedBalance(collateralAsset);
      if (collateralAmount > normalizedCollateralBalance) {
        // if there still arent enough funds then revert or TODO: return partial amount
        revert("Insufficient funds for a full withdrawal");
      }
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
   * @return Net Asset Value
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
      uint256 time = (expiration - block.timestamp.fromUint()).div(ONE_YEAR_SECONDS);
      int underlying = int(underlyingPrice);
      int spot_distance = (int(strikePrice) - int(underlying)).div(underlying);
      int[2] memory points = [spot_distance, int(time)];
      int[7] memory coef = isPut ? putsVolatilitySkew : callsVolatilitySkew;
      return uint(OptionsCompute.computeIVFromSkew(coef, points));
    }

  /**
   * @notice get a price quote for a given optionSeries
   * @param  optionSeries Types.OptionSeries struct for describing the option to price
   * @return Quote price of the option
   */
  function quotePrice(
    Types.OptionSeries memory optionSeries
  )
    public
    view
    returns (uint)
  {
    uint underlyingPrice = getUnderlyingPrice(optionSeries);
    uint iv = getImpliedVolatility(optionSeries.isPut, underlyingPrice, optionSeries.strike, optionSeries.expiration);
    require(iv > 0, "Implied volatility not found");
    require(optionSeries.expiration > block.timestamp, "Already expired");
    uint quote = BlackScholes.blackScholesCalc(
       underlyingPrice,
       optionSeries.strike,
       optionSeries.expiration,
       iv,
       riskFreeRate,
       optionSeries.isPut
    );
    return quote;
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
      public
      view
      returns (uint256 quote, int256 delta, uint256 underlyingPrice)
  {
      underlyingPrice = getUnderlyingPrice(optionSeries);
      uint iv = getImpliedVolatility(optionSeries.isPut, underlyingPrice, optionSeries.strike, optionSeries.expiration);
      require(iv > 0, "Implied volatility not found");
      if (isBuying) {
        iv = iv - bidAskIVSpread;
      }
      require(optionSeries.expiration > block.timestamp, "Already expired");
      underlyingPrice = getUnderlyingPrice(optionSeries);
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
      return callsDelta + putsDelta + externalDelta;
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
  function rebalancePortfolioDelta(int256 delta)
    public 
  { 
      if(abs(delta) > dustValue) {
      // TODO check to see if we can be paid to open a position using derivatives using funding rate
        IHedgingReactor(hedgingReactors[0]).hedgeDelta(delta);
      }
      // TODO if we dont / not enough - look at derivatives
  }
    
  /**
   * @notice get the quote price for a given option
   * @param  optionSeries option type to quote
   * @param  amount       the number of options to mint 
   * @return quote the price of the options
   */
  function quotePriceWithUtilization(
    Types.OptionSeries memory optionSeries,
    uint amount
  )
    public
    view
    returns (uint)
  {
    uint optionQuote = quotePrice(optionSeries);
    uint optionPrice = amount < PRBMathUD60x18.scale() ? optionQuote.mul(amount) : optionQuote;
    uint underlyingPrice = getUnderlyingPrice(optionSeries);
    uint utilization = amount.div(totalSupply);
    uint utilizationPrice = underlyingPrice.mul(utilization);
    return utilizationPrice > optionPrice ? utilizationPrice : optionPrice;
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
      (uint256 optionQuote,  int256 deltaQuote,) = quotePriceGreeks(optionSeries, false);
      UtilizationState memory quoteState;
      quoteState.optionPrice = optionQuote.mul(amount);
      uint underlyingPrice = getUnderlyingPrice(optionSeries);
      int portfolioDelta = getPortfolioDelta();
      int newDelta = PRBMathSD59x18.abs(portfolioDelta + deltaQuote);
      // assumes a single collateral type regardless of call or put
      uint utilization = quoteState.optionPrice.div(totalSupply);
      quoteState.isDecreased = newDelta < PRBMathSD59x18.abs(portfolioDelta);
      uint normalizedDelta = uint256(newDelta).div(_getNAV());
      uint maxPrice = optionSeries.isPut ? optionSeries.strike : underlyingPrice;
      quoteState.utilizationPrice = maxPrice.mul(utilization);
      quoteState.deltaTiltFactor = (maxPrice.mul(normalizedDelta)).div(quoteState.optionPrice);
      if (quoteState.isDecreased) {
        uint discount = quoteState.deltaTiltFactor > maxDiscount ? maxDiscount : quoteState.deltaTiltFactor;
        uint newOptionPrice = quoteState.optionPrice - discount.mul(quoteState.optionPrice);
        quoteState.utilizationPrice = quoteState.utilizationPrice - discount.mul(quoteState.utilizationPrice);
        quote = quoteState.utilizationPrice > newOptionPrice ? quoteState.utilizationPrice : newOptionPrice;
      } else {
        uint newOptionPrice = quoteState.deltaTiltFactor.mul(quoteState.optionPrice) + quoteState.optionPrice;
        if (quoteState.utilizationPrice < maxPrice) {
          quoteState.utilizationPrice = quoteState.deltaTiltFactor.mul(quoteState.utilizationPrice) + quoteState.utilizationPrice;
          quote = quoteState.utilizationPrice > newOptionPrice ? quoteState.utilizationPrice : newOptionPrice;
        } else {
          quote = maxPrice;
        }
      }
      delta = deltaQuote;
      //@TODO think about more robust considitions for this check
      if (quote == 0 || delta == int(0)) { revert DeltaQuoteError(quote, delta); }
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
      (uint256 optionQuote,  int256 deltaQuote,) = quotePriceGreeks(optionSeries, true);
      quote = optionQuote.mul(amount);
      delta = deltaQuote;
      //@TODO think about more robust considitions for this check
      if (quote == 0 || delta == int(0)) { revert DeltaQuoteError(quote, delta); }
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
  ) public payable returns (uint optionAmount, address series)
  {
    // check the strike and expiry are within allowed bounds
    require(optionParams.minExpiry <= optionSeries.expiration && optionSeries.expiration <= optionParams.maxExpiry, "invalid expiry");
    if(optionSeries.isPut){
    require(optionParams.minPutStrikePrice <= optionSeries.strike && optionSeries.strike <= optionParams.maxPutStrikePrice, "invalid strike price");
    } else {
      (optionParams.minCallStrikePrice <= optionSeries.strike && optionSeries.strike <= optionParams.maxCallStrikePrice, "invalid strike price");
    }
    OptionRegistry optionRegistry = getOptionRegistry();
    require(optionSeries.collateral == collateralAsset, "!collateral");
    series = optionRegistry.issue(
       optionSeries.underlying,
       optionSeries.strikeAsset,
       optionSeries.expiration.toUint(),
       optionSeries.isPut,
       optionSeries.strike,
       collateralAsset
    );
    optionAmount = writeOption(series, amount);
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
    payable
    returns (uint256)
  {
    OptionRegistry optionRegistry = getOptionRegistry();
    Types.OptionSeries memory optionSeries = optionRegistry.getSeriesInfo(seriesAddress);
    // expiration requires conversion back due to option protocol not using PRB floats
    optionSeries.expiration = optionSeries.expiration.fromUint();
    require(optionSeries.strikeAsset == strikeAsset, "incorrect strike asset");
    bool isPut = optionSeries.isPut;
    (uint256 premium,) = quotePriceWithUtilizationGreeks(optionSeries, amount);
    // premium needs to adjusted for decimals of base strike asset
    SafeTransferLib.safeTransferFrom(strikeAsset, msg.sender, address(this), OptionsCompute.convertToDecimals(premium, IERC20(strikeAsset).decimals()));
    uint256 collateralAmount;
    if (underlyingAsset == collateralAsset) {
      collateralAmount = amount;
    } else if (strikeAsset == collateralAsset) {
      collateralAmount = OptionsCompute.computeEscrow(amount, optionSeries.strike, IERC20(collateralAsset).decimals());
    }
    
    require(IERC20(collateralAsset).balanceOf(address(this)) >= collateralAmount, "Insufficient balance for collateral");

    IERC20(collateralAsset).approve(address(optionRegistry), collateralAmount);
    (, collateralAmount) = optionRegistry.open(seriesAddress, amount);
    emit WriteOption(seriesAddress, amount, premium, collateralAmount, msg.sender);
    

    if (!isPut) {
        (uint newTotal, uint newWeight, uint newTime) = OptionsCompute.computeNewWeights(
            amount, optionSeries.strike, optionSeries.expiration, totalAmountCall, weightedStrikeCall, weightedTimeCall);
        totalAmountCall = newTotal;
        weightedStrikeCall = newWeight;
        weightedTimeCall = newTime;
        // TODO: make sure this is ok with collateral types
        collateralAllocated += collateralAmount;
    } else {
        (uint newTotal, uint newWeight, uint newTime) = OptionsCompute.computeNewWeights(
            amount, optionSeries.strike, optionSeries.expiration, totalAmountPut, weightedStrikePut, weightedTimePut);
        totalAmountPut = newTotal;
        weightedStrikePut = newWeight;
        weightedTimePut = newTime;
        collateralAllocated += collateralAmount;
    }
    SafeTransferLib.safeTransfer(ERC20(seriesAddress), msg.sender, OptionsCompute.convertToDecimals(amount, IERC20(seriesAddress).decimals()));
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
  ) public nonReentrant returns (uint256){
     if (!buybackWhitelist[msg.sender]){
      // address is not on the whitelist
      //TODO run some checks to determine if we want to buy this option back
    }
    OptionRegistry optionRegistry = getOptionRegistry();  
    address seriesAddress = optionRegistry.issue(
       optionSeries.underlying,
       optionSeries.strikeAsset,
       optionSeries.expiration.toUint(),
       optionSeries.isPut,
       optionSeries.strike,
       collateralAsset
    );      
    bool isPut = optionSeries.isPut;
    SafeTransferLib.safeApprove(ERC20(seriesAddress), address(optionRegistry), OptionsCompute.convertToDecimals(amount, IERC20(seriesAddress).decimals()));
    SafeTransferLib.safeTransferFrom(seriesAddress, msg.sender, address(this), OptionsCompute.convertToDecimals(amount, IERC20(seriesAddress).decimals()));
  
    //TODO create IV skew specifically for buyback 
    //TODO swap out quotePriceWithUtilization for new buyback pricing func
    uint256 premium = quotePriceWithUtilization(optionSeries, amount);
    (, uint collateralReturned) = optionRegistry.close(seriesAddress, amount);
    emit BuybackOption(seriesAddress, amount, premium, collateralReturned, msg.sender);

    if (!isPut) {
      (uint newTotal, uint newWeight, uint newTime) = OptionsCompute.computeNewWeightsBuyback(
          amount, optionSeries.strike, optionSeries.expiration, totalAmountCall, weightedStrikeCall, weightedTimeCall);
      totalAmountCall = newTotal;
      weightedStrikeCall = newWeight;
      weightedTimeCall = newTime;
      // TODO: make sure this is ok with collateral types
      collateralAllocated -= collateralReturned;
    } else {
      (uint newTotal, uint newWeight, uint newTime) = OptionsCompute.computeNewWeightsBuyback(
          amount, optionSeries.strike, optionSeries.expiration, totalAmountPut, weightedStrikePut, weightedTimePut);
      totalAmountPut = newTotal;
      weightedStrikePut = newWeight;
      weightedTimePut = newTime;
      collateralAllocated -= collateralReturned;
    }
    SafeTransferLib.safeTransfer(ERC20(strikeAsset), msg.sender, OptionsCompute.convertToDecimals(premium, IERC20(strikeAsset).decimals()));
    return amount;
  }
}
