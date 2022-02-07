pragma solidity >=0.8.0;
pragma experimental ABIEncoderV2;

import { Constants } from "./libraries/Constants.sol";
import { OptionsCompute } from "./libraries/OptionsCompute.sol";
import { TransferHelper } from "./libraries/TransferHelper.sol";
import { SafeTransferLib } from "./libraries/SafeTransferLib.sol";
import { SafeERC20 } from "./tokens/SafeERC20.sol";
import "./tokens/ERC20.sol";
import "./OpynOptionRegistry.sol";
import "./libraries/Math.sol";
import "./libraries/BlackScholes.sol";
import "./tokens/UniversalERC20.sol";
import "./OptionsProtocol.sol";
import "./PriceFeed.sol";
import "./access/Ownable.sol";
import "./interfaces/IHedgingReactor.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "hardhat/console.sol";

error MinStrikeAmountExceedsLiquidity(uint256 strikeAmount, uint256 strikeAmountMin);
error MinUnderlyingAmountExceedsLiquidity(uint256 underlyingAmount, uint256 underlyingAmountMin);
error StrikeAmountExceedsLiquidity(uint256 strikeAmount, uint256 strikeLiquidity);
error UnderlyingAmountExceedsLiquidity(uint256 underlyingAmount, uint256 underlyingLiquidity);

contract LiquidityPool is
  ERC20,
  Ownable
{
  using UniversalERC20 for IERC20;
  using PRBMathSD59x18 for int256;
  using PRBMathUD60x18 for uint256;
  using Math for uint256;

  uint256 private constant ONE_YEAR_SECONDS = 31557600000000000000000000;
  uint8 private constant SCALE_DECIMALS = 18;

  address[] public hedgingReactors;

  address public protocol;
  address public strikeAsset;
  address public underlyingAsset;
  uint public riskFreeRate; // riskFreeRate as a percentage PRBMath Float. IE: 3% -> 0.03 * 10**18
  uint public strikeAllocated;
  uint public underlyingAllocated;
  uint public maxTotalSupply = type(uint256).max;

  uint public totalAmountCall;
  uint public totalAmountPut;
  uint public weightedStrikeCall;
  uint public weightedTimeCall;
  uint public weightedStrikePut;
  uint public weightedTimePut;
  int[7] public callsVolatilitySkew;
  int[7] public putsVolatilitySkew;
  // Implied volatility for an underlying
  mapping(address => uint) public impliedVolatility;

  event LiquidityAdded(uint amount);
  event UnderlyingAdded(address underlying);
  event ImpliedVolatilityUpdated(address underlying, uint iv);
  event LiquidityDeposited(uint strikeAmount, uint underlyingAmount);
  event LiquidityRemoved(address user, uint shares,  uint strikeAmount, uint underlyingAmount);
  event WriteOption(address series, uint amount, uint premium, uint escrow, address buyer);

  constructor(address _protocol, address _strikeAsset, address underlying, uint rfr, int[7] memory callSkew, int[7] memory putSkew, string memory name, string memory symbol) ERC20(name, symbol) {
    strikeAsset = IERC20(_strikeAsset).isETH() ? Constants.ethAddress() : _strikeAsset;
    riskFreeRate = rfr;
    address underlyingAddress = IERC20(underlying).isETH() ? Constants.ethAddress() : underlying;
    underlyingAsset = underlyingAddress;
    callsVolatilitySkew = callSkew;
    putsVolatilitySkew = putSkew;
    protocol = _protocol;
    emit UnderlyingAdded(underlyingAddress);
  }

  function setHedgingReactorAddress(address _reactorAddress) onlyOwner public {
    hedgingReactors.push(_reactorAddress);
  }

  function removeHedgingReactorAddress(uint256 _index) onlyOwner public {
    delete hedgingReactors[_index];
  }

  function setVolatilitySkew(int[7] calldata values, Types.Flavor flavor)
      onlyOwner
      external
      returns (bool)
  {
      if (Types.isCall(flavor)) {
          callsVolatilitySkew = values;
      } else {
          putsVolatilitySkew = values;
      }
  }

  function getVolatilitySkew(Types.Flavor flavor)
      external
      view
      returns (int[7] memory)
  {
      if (Types.isCall(flavor)) {
          return callsVolatilitySkew;
      } else {
          return putsVolatilitySkew;
      }
  }

  function setMaxTotalSupply(uint256 _maxTotalSupply) external onlyOwner {
      maxTotalSupply = _maxTotalSupply;
  }

  /**
   * @notice function for adding liquidity to the options liquidity pool
   * @param strikeAmountDesired Max amount of strikeAsset to deposit
   * @param underlyingAmountDesired Max amount of underlyingAsset to deposit
   * @param strikeAmountMin Revert if resulting `strikeAmount` is less than this
   * @param underlyingAmountMin Revert if resulting `underlyingAmount` is less than this
   * @return shares Number of shares minted
   * @return strikeAmount Amount of strikeAsset deposited
   * @return underlyingAmount Amount of underlyingAsset deposited
   * @dev    entry point to provide liquidity to dynamic hedging vault 
   */
  function addLiquidity(
    uint strikeAmountDesired,
    uint underlyingAmountDesired,
    uint strikeAmountMin,
    uint underlyingAmountMin
    )
    external
    returns(uint shares, uint strikeAmount, uint underlyingAmount)
  {
    require(strikeAmountDesired > 0 || underlyingAmountDesired> 0, "strikeAmountDesired or underlyingAmountDesired");

    // Calculate amounts proportional to pool's holdings
    (shares, strikeAmount, underlyingAmount) = _calcSharesAndAmounts(strikeAmountDesired, underlyingAmountDesired);
    require(shares > 0, "shares");
    require(strikeAmount >= strikeAmountMin, "strikeAmountMin");
    require(underlyingAmount >= underlyingAmountMin, "underlyingAmountMin");

    // Pull in tokens from sender
    if (strikeAmount > 0) SafeTransferLib.safeTransferFrom(strikeAsset, msg.sender, address(this), strikeAmount);
    if (underlyingAmount > 0) SafeTransferLib.safeTransferFrom(underlyingAsset, msg.sender, address(this), underlyingAmount);
    _mint(msg.sender, shares);
    emit LiquidityDeposited(strikeAmount, underlyingAmount);
    require(totalSupply() <= maxTotalSupply, "maxTotalSupply");
  }

  /**
   * @notice function for removing liquidity from the options liquidity pool
   * @param shares number of shares to burn
   * @param strikeAmountMin minimum strike amount to receive (revert if amount received is lower)
   * @param underlyingAmountMin minimum underlying amount to receive Revert if resulting `underlyingAmount` is less than this
   * @return strikeAmount Amount of strikeAsset withdrawn
   * @return underlyingAmount Amount of underlyingAsset withdrawn
   * @dev    entry point to remove liquidity to dynamic hedging vault 
   */
  function removeLiquidity(
    uint shares,
    uint strikeAmountMin,
    uint underlyingAmountMin
  )
    external
    returns(uint strikeAmount, uint underlyingAmount)
  {
    require(shares > 0, "!shares");
    uint256 totalSupply = totalSupply();
    uint256 ratio = shares.div(totalSupply);
    _burn(msg.sender, shares);

    // Calculate liquidity that can be withdrawn
    (uint256 normalizedStrikeBalance,, uint256 decimals) = getNormalizedBalance(strikeAsset);
    // new scope to avoid stack too deep error
    {
      uint256 strikeEquity = normalizedStrikeBalance - _valuePutsWritten();
      uint256 strikeLiquidity = normalizedStrikeBalance - _calcStrikeCommitted();
      strikeAmount = strikeEquity.mul(ratio);
      if (strikeAmountMin > strikeAmount) { revert MinStrikeAmountExceedsLiquidity(strikeAmount, strikeAmountMin); }
      if (strikeAmount > strikeLiquidity) { revert StrikeAmountExceedsLiquidity(strikeAmount, strikeLiquidity); }
      uint256 underlyingBalance = IERC20(underlyingAsset).balanceOf(address(this));
      uint256 underlyingEquity = underlyingBalance - _valueCallsWritten();
      uint256 underlyingLiquidity = underlyingBalance - totalAmountCall;
      underlyingAmount = underlyingEquity.mul(ratio);
      if (underlyingAmountMin > underlyingAmount) { revert MinUnderlyingAmountExceedsLiquidity(underlyingAmount, underlyingAmountMin); }
      if (underlyingAmount > underlyingLiquidity) { revert UnderlyingAmountExceedsLiquidity(underlyingAmount, underlyingAmountMin); }
    }
    uint256 transferStrikeAmount = OptionsCompute.convertToDecimals(strikeAmount, decimals);
    IERC20(strikeAsset).universalTransfer(msg.sender, transferStrikeAmount);
    IERC20(underlyingAsset).universalTransfer(msg.sender, underlyingAmount);
    //TODO implement book balance reconcilation check
    emit LiquidityRemoved(msg.sender, shares, transferStrikeAmount, underlyingAmount);
  }

  /**
   * @notice Returning balance in 1e18 format
   * @param asset address of the asset to get balance and normalize
   * @return normalizedBalance balance in 1e18 format
   * @return strikeBalance balance in original decimal format
   * @return decimals decimals of asset
   */
  function getNormalizedBalance(
    address asset
  )
    internal
    view
    returns (uint256 normalizedBalance, uint256 strikeBalance, uint256 decimals) 
  {
    strikeBalance = IERC20(asset).balanceOf(address(this));
    decimals = IERC20(asset).decimals();
    normalizedBalance = OptionsCompute.convertFromDecimals(strikeBalance, decimals);
  }

  function _valuePutsWritten()
      internal
      view
      returns (uint)
  {
      if (weightedStrikePut == 0) return uint(0);
      uint underlyingPrice = getUnderlyingPrice(underlyingAsset, strikeAsset);
      // TODO Consider using VAR (value at risk) approach in the future
      uint iv = getImpliedVolatility(Types.Flavor.Put, underlyingPrice, weightedStrikePut, weightedTimePut);
      uint price = BlackScholes.blackScholesCalc(
         underlyingPrice,
         weightedStrikePut,
         weightedTimePut,
         iv,
         riskFreeRate,
         Types.Flavor.Put
      );
      return totalAmountPut.mul(price);      
  }

  function _valueCallsWritten()
      internal
      view
      returns (uint)
  {
      if (weightedStrikeCall == 0) return uint(0);
      uint underlyingPrice = getUnderlyingPrice(underlyingAsset, strikeAsset);
      uint iv = getImpliedVolatility(Types.Flavor.Call, underlyingPrice, weightedStrikeCall, weightedTimeCall);
      uint price = BlackScholes.blackScholesCalc(
        underlyingPrice,
        weightedStrikePut,
        weightedTimePut,
        iv,
        riskFreeRate,
        Types.Flavor.Call
      );     
      uint callsValue = totalAmountCall.mul(uint256(price)).div(underlyingPrice);
      return callsValue.min(totalAmountCall);
  }

  function _calcStrikeCommitted()
      internal
      view
      returns (uint)
  {
      // TODO consider caching this into a variable when put is written
      return totalAmountPut.mul(weightedStrikePut);
  }

  function _calcSharesAndAmounts(uint strikeAmountDesired, uint underlyingAmountDesired)
    internal
    view
    returns
    (uint shares, uint strikeAmount, uint underlyingAmount)
  {
    uint totalSupply = totalSupply();
    uint strikeTotal = IERC20(strikeAsset).universalBalanceOf(address(this)) + strikeAllocated;
    uint underlyingTotal = IERC20(underlyingAsset).universalBalanceOf(address(this)) + underlyingAllocated;

    if (totalSupply == 0) {
      strikeAmount = strikeAmountDesired;
      underlyingAmount = underlyingAmountDesired;
      shares = Math.max(strikeAmount, underlyingAmount);
    } else if (strikeTotal == 0) {
      underlyingAmount = underlyingAmountDesired;
      shares = underlyingAmount.mul(totalSupply).div(underlyingTotal);
    } else if (underlyingTotal == 0) {
      strikeAmount = strikeAmountDesired;
      shares = strikeAmount.mul(totalSupply).div(strikeTotal);
    } else {
      uint cross = Math.min(strikeAmountDesired.mul(underlyingTotal), underlyingAmountDesired.mul(strikeTotal));
      require(cross > 0, "cross");

      // do rounding
      strikeAmount = (cross - 1).div(underlyingTotal) + 1;
      underlyingAmount = (cross - 1).div(strikeTotal) + 1;
      shares = cross.mul(totalSupply).div(strikeTotal).div(underlyingTotal);
    }
  }

  function getPriceFeed() internal view returns (PriceFeed) {
    address feedAddress = Protocol(protocol).priceFeed();
    return PriceFeed(feedAddress);
  }

  function getOpynOptionRegistry() internal returns (OpynOptionRegistry) {
    address registryAddress = Protocol(protocol).optionRegistry();
    return OpynOptionRegistry(registryAddress);
  }

  function getUnderlyingPrice(
    Types.OptionSeries memory optionSeries
  )
    internal
    view
    returns (uint)
  {
    return getUnderlyingPrice(optionSeries.underlying, optionSeries.strikeAsset);
  }

  function getUnderlyingPrice(
    address underlying,
    address strikeAsset
  )
      internal
      view
      returns (uint)
  {
      PriceFeed priceFeed = getPriceFeed();
      uint underlyingPrice = priceFeed.getNormalizedRate(
        underlying,
        strikeAsset
     );
      return underlyingPrice;
  }

  /**
   * @param flavor Is the option a call or put?
   * @param underlyingPrice The underlying price 
   * @param strikePrice The strike price of the option
   * @param expiration expiration timestamp of option as a PRBMath Float
   * @return Implied volatility adjusted for volatility surface
   */
  function getImpliedVolatility(
    Types.Flavor flavor,
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
      int[7] memory coef = flavor == Types.Flavor.Call ? callsVolatilitySkew : putsVolatilitySkew;
      return uint(OptionsCompute.computeIVFromSkew(coef, points));
    }
  
  /**
   * @param quote A 10**18 price quote
   * @return Quote adjusted for the decimals of the strike asset
   */
  function toDecimals(
    uint256 quote,
    address token
  ) 
    internal 
    view
    returns (uint)
  {
    uint256 decimals = IERC20(token).decimals();
    uint difference;
    if (SCALE_DECIMALS > decimals) {
      difference = SCALE_DECIMALS - decimals;
      return quote / (10**difference);
    }
    difference = decimals - SCALE_DECIMALS;
    return quote * (10**difference);
  }

  function quotePrice(
    Types.OptionSeries memory optionSeries
  )
    public
    view
    returns (uint)
  {
    uint underlyingPrice = getUnderlyingPrice(optionSeries);
    uint iv = getImpliedVolatility(optionSeries.flavor, underlyingPrice, optionSeries.strike, optionSeries.expiration);
    require(iv > 0, "Implied volatility not found");
    require(optionSeries.expiration > block.timestamp, "Already expired");
    uint quote = BlackScholes.blackScholesCalc(
       underlyingPrice,
       optionSeries.strike,
       optionSeries.expiration,
       iv,
       riskFreeRate,
       optionSeries.flavor
    );
    return quote;
  }

  function quotePriceGreeks(
     Types.OptionSeries memory optionSeries
  )
      public
      view
      returns (uint256 quote, int256 delta, uint256 underlyingPrice)
  {
      underlyingPrice = getUnderlyingPrice(optionSeries);
      uint iv = getImpliedVolatility(optionSeries.flavor, underlyingPrice, optionSeries.strike, optionSeries.expiration);
      uint ivNorm = iv.div(PRBMathUD60x18.SCALE).mul(100);
      require(iv > 0, "Implied volatility not found");
      require(optionSeries.expiration > block.timestamp, "Already expired");
      underlyingPrice = getUnderlyingPrice(optionSeries);
      (quote, delta) = BlackScholes.blackScholesCalcGreeks(
       underlyingPrice,
       optionSeries.strike,
       optionSeries.expiration,
       iv,
       riskFreeRate,
       optionSeries.flavor
      );
  }

  function getPortfolioDelta()
      public
      view
      returns (int256)
  {
      uint256 price = getUnderlyingPrice(underlyingAsset, strikeAsset);
      uint256 callIv = getImpliedVolatility(Types.Flavor.Call, price, weightedStrikeCall, weightedTimeCall);
      uint256 putIv = getImpliedVolatility(Types.Flavor.Put, price, weightedStrikePut, weightedTimePut);
      uint256 rfr = riskFreeRate;
      int256 callsDelta = BlackScholes.getDelta(
         price,
         weightedStrikeCall,
         weightedTimeCall,
         callIv,
         rfr,
         Types.Flavor.Call
      );
      int256 putsDelta = BlackScholes.getDelta(
         price,
         weightedStrikePut,
         weightedTimePut,
         putIv,
         rfr,
         Types.Flavor.Put
      );
      // TODO fix hedging reactor address to be dynamic
      int256 externalDelta = IHedgingReactor(hedgingReactors[0]).getDelta(); // TODO add getDelta from other reactors when complete
      return callsDelta + putsDelta + externalDelta;
  }

  /// @dev value below which delta is not worth dedging due to gas costs
  int256 private dustValue;

  /// @notice function to return absolute value of input
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
    uint utilization = amount.div(totalSupply());
    uint utilizationPrice = underlyingPrice.mul(utilization);
    return utilizationPrice > optionPrice ? utilizationPrice : optionPrice;
  }

  function quotePriceWithUtilizationGreeks(
    Types.OptionSeries memory optionSeries,
    uint amount
  )
      public
      view
      returns (uint256 quote, int256 delta)
  {
      (uint256 optionQuote,  int256 deltaQuote,) = quotePriceGreeks(optionSeries);
      uint optionPrice = amount < PRBMathUD60x18.scale() ? optionQuote.mul(amount) : optionQuote;
      uint underlyingPrice = getUnderlyingPrice(optionSeries);
      // factor in portfolio delta
      // if decreases portfolio delta quote standard bs
      // abs(portfolio delta + new delta) < abs(portfolio delta)
      uint utilization = amount.div(totalSupply());
      uint utilizationPrice = underlyingPrice.mul(utilization);
      quote = utilizationPrice > optionPrice ? utilizationPrice : optionPrice;
      delta = deltaQuote;
  }

  function issueAndWriteOption(
     Types.OptionSeries memory optionSeries,
     uint amount,
     address collateral
  ) public payable returns (uint optionAmount, address series)
  {
    OpynOptionRegistry optionRegistry = getOpynOptionRegistry();
    series = optionRegistry.issue(
       optionSeries.underlying,
       optionSeries.strikeAsset,
       optionSeries.expiration.toUint(),
       optionSeries.flavor,
       optionSeries.strike,
       collateral
    );
    optionAmount = writeOption(series, amount);
  }

  function writeOption(
    address seriesAddress,
    uint amount
  )
    public
    payable
    returns (uint)
  {
    OpynOptionRegistry optionRegistry = getOpynOptionRegistry();
    Types.OptionSeries memory optionSeries = optionRegistry.getSeriesInfo(seriesAddress);
    // expiration requires conversion back due to opyn not use PRB floats
    optionSeries.expiration = optionSeries.expiration.fromUint();
    require(optionSeries.strikeAsset == strikeAsset, "incorrect strike asset");
    Types.Flavor flavor = optionSeries.flavor;
    //TODO breakout into function to support multiple collateral types
    address escrowAsset = Types.isCall(flavor) ? underlyingAsset : strikeAsset;
    uint premium = quotePriceWithUtilization(optionSeries, amount);
    // premium needs to adjusted for decimals of base strike asset
    TransferHelper.safeTransferFrom(strikeAsset, msg.sender, address(this), toDecimals(premium, strikeAsset));
    uint escrow = Types.isCall(flavor) ? amount : OptionsCompute.computeEscrow(amount, optionSeries.strike, IERC20(strikeAsset).decimals());
    require(IERC20(escrowAsset).universalBalanceOf(address(this)) >= escrow, "Insufficient balance for escrow");
    // TODO Consider removing this conditional to support only ERC20 tokens
    if (IERC20(optionSeries.underlying).isETH()) {
        optionRegistry.open(seriesAddress, amount);
        emit WriteOption(seriesAddress, amount, premium, escrow, msg.sender);
    } else {
        IERC20(escrowAsset).approve(address(optionRegistry), escrow);
        optionRegistry.open(seriesAddress, amount);
        emit WriteOption(seriesAddress, amount, premium, escrow, msg.sender);
    }

    if (Types.isCall(flavor)) {
        (uint newTotal, uint newWeight, uint newTime) = OptionsCompute.computeNewWeights(
            amount, optionSeries.strike, optionSeries.expiration, totalAmountCall, weightedStrikeCall, weightedTimeCall);
        totalAmountCall = newTotal;
        weightedStrikeCall = newWeight;
        weightedTimeCall = newTime;
    } else {
        (uint newTotal, uint newWeight, uint newTime) = OptionsCompute.computeNewWeights(
            amount, optionSeries.strike, optionSeries.expiration, totalAmountPut, weightedStrikePut, weightedTimePut);
        totalAmountPut = newTotal;
        weightedStrikePut = newWeight;
        weightedTimePut = newTime;
    }
    IERC20(seriesAddress).universalTransfer(msg.sender, toDecimals(amount, seriesAddress));
  }
}
