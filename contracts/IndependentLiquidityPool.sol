pragma solidity >=0.8.0;
pragma experimental ABIEncoderV2;

import { Constants } from "./libraries/Constants.sol";
import { OptionsCompute } from "./libraries/OptionsCompute.sol";
import { TransferHelper } from "./libraries/TransferHelper.sol";
import "./libraries/BlackScholes.sol";
import "./tokens/ERC20.sol";
import "./OptionRegistry.sol";
import "./libraries/ABDKMathQuad.sol";
import "./libraries/Math.sol";
import "./tokens/UniversalERC20.sol";
import "./PriceFeed.sol";
import "./access/Ownable.sol";
import "./libraries/PRBMathSD59x18.sol";
import "./libraries/PRBMathUD60x18.sol";

contract IndependentLiquidityPool is
  ERC20,
  Ownable
{
  using UniversalERC20 for IERC20;
  using ABDKMathQuad for bytes16;
  using PRBMathInt for int256;
  using PRBMathUint for uint256;
  using Math for uint256;

  bytes16 private constant ONE = 0x3fff0000000000000000000000000000;

  PriceFeed private priceFeed;
  OptionRegistry private optionRegistry;
  address public strikeAsset;
  address public underlyingAsset;
  uint private riskFreeRate;
  uint private strikeAllocated;
  uint private underlyingAllocated;
  uint private maxTotalSupply = type(uint256).max;

  uint private totalAmountCall;
  uint private totalAmountPut;
  uint private weightedStrikeCall;
  uint private weightedTimeCall;
  uint private weightedStrikePut;
  uint private weightedTimePut;
  int[7] private callsVolatilitySkew;
  int[7] private putsVolatilitySkew;
  // Implied volatility for an underlying
  mapping(address => uint) public impliedVolatility;

  event LiquidityAdded(uint amount);
  event UnderlyingAdded(address underlying);
  event ImpliedVolatilityUpdated(address underlying, uint iv);
  event LiquidityDeposited(uint strikeAmount, uint underlyingAmount);
  event LiquidityRemoved(address user, uint shares,  uint strikeAmount, uint underlyingAmount);
  event WriteOption(address series, uint amount, uint premium, uint escrow, address buyer);

  constructor(address _priceFeed, address _optionRegistry, address _strikeAsset, address underlying, uint rfr, uint iv, string memory name, string memory symbol) ERC20(name, symbol) public {
    strikeAsset = IERC20(_strikeAsset).isETH() ? Constants.ethAddress() : _strikeAsset;
    riskFreeRate = rfr;
    address underlyingAddress = IERC20(underlying).isETH() ? Constants.ethAddress() : underlying;
    underlyingAsset = underlyingAddress;
    impliedVolatility[underlyingAddress] = iv;
    priceFeed = PriceFeed(_priceFeed);
    optionRegistry = OptionRegistry(_optionRegistry);
    emit UnderlyingAdded(underlyingAddress);
    emit ImpliedVolatilityUpdated(underlyingAddress, iv);
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
    require(strikeAmountDesired > 0 || underlyingAmountDesired> 0);

    // Calculate amounts proportional to pool's holdings
    (shares, strikeAmount, underlyingAmount) = _calcSharesAndAmounts(strikeAmountDesired, underlyingAmountDesired);
    require(shares > 0, "shares");
    require(strikeAmount >= strikeAmountMin, "strikeAmountMin");
    require(underlyingAmount >= underlyingAmountMin, "underlyingAmountMin");

    // Pull in tokens from sender
    if (strikeAmount > 0) TransferHelper.safeTransferFrom(strikeAsset, msg.sender, address(this), strikeAmount);
    if (underlyingAmount > 0) TransferHelper.safeTransferFrom(underlyingAsset, msg.sender, address(this), underlyingAmount);
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
    uint256 strikeBalance = IERC20(strikeAsset).balanceOf(address(this));
    uint256 strikeEquity = strikeBalance - _valuePutsWritten();
    uint256 strikeLiquidity = strikeBalance - _calcStrikeCommitted();
    strikeAmount = strikeEquity.mul(ratio);
    require(strikeAmountMin <= strikeAmount, "strikeMin exceeds");
    require(strikeAmount <= strikeLiquidity, "strikeAmount exceeds");
    uint256 underlyingBalance = IERC20(underlyingAsset).balanceOf(address(this));
    uint256 underlyingEquity = underlyingBalance - _valueCallsWritten();
    uint256 underlyingLiquidity = IERC20(underlyingAsset).balanceOf(address(this)) - totalAmountCall;
    underlyingAmount = underlyingEquity.mul(ratio);
    require(underlyingAmountMin <= underlyingAmount, "underlyingMin exceeds");
    require(underlyingAmount <= underlyingLiquidity, "underlyingAmount exceeds");

    IERC20(strikeAsset).universalTransfer(msg.sender, strikeAmount);
    IERC20(underlyingAsset).universalTransfer(msg.sender, underlyingAmount);
    emit LiquidityRemoved(msg.sender, shares, strikeAmount, underlyingAmount);
  }

  function _valuePutsWritten()
      internal
      view
      returns (uint)
  {
      if (weightedStrikePut == 0) return uint(0);
      uint underlyingPrice = getUnderlyingPrice(underlyingAsset, strikeAsset);
      // TODO replace with skew
      // TODO Consider using VAR (value at risk) approach in the future
      uint iv = impliedVolatility[underlyingAsset];
      uint price = BlackScholes.retBlackScholesCalc(
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
      //TODO replace with skew
      uint iv = impliedVolatility[underlyingAsset];
      uint price = BlackScholes.retBlackScholesCalc(
         underlyingPrice,
         weightedStrikeCall,
         weightedTimeCall,
         iv,
         riskFreeRate,
         Types.Flavor.Call
      );
      uint callsValue = totalAmountCall.mul(price).div(underlyingPrice);
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
      uint underlyingPrice = priceFeed.getNormalizedRate(
        underlying,
        strikeAsset
     );
      return underlyingPrice;
  }

  function quotePrice(
    Types.OptionSeries memory optionSeries
  )
    public
    view
    returns (uint)
  {
    uint iv = impliedVolatility[optionSeries.underlying];
    require(iv > 0, "Implied volatility not found");
    require(optionSeries.expiration > block.timestamp, "Already expired");
    uint underlyingPrice = getUnderlyingPrice(optionSeries);
    return BlackScholes.retBlackScholesCalc(
       underlyingPrice,
       optionSeries.strike,
       optionSeries.expiration,
       iv,
       riskFreeRate,
       optionSeries.flavor
    );
  }

  function quotePriceGreeks(
     Types.OptionSeries memory optionSeries
  )
      public
      view
      returns (bytes16 quote, bytes16 delta, uint256 underlyingPrice)
  {
      uint iv = impliedVolatility[optionSeries.underlying];
      require(iv > 0, "Implied volatility not found");
      require(optionSeries.expiration > block.timestamp, "Already expired");
      underlyingPrice = getUnderlyingPrice(optionSeries);
      (quote, delta) = BlackScholes.retBlackScholesCalcGreeks(
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
      returns (bytes16)
  {
      bytes16 price = ABDKMathQuad.fromUInt(getUnderlyingPrice(underlyingAsset, strikeAsset));
      bytes16 vol = ABDKMathQuad.fromUInt(impliedVolatility[underlyingAsset]);
      bytes16 rfr = ABDKMathQuad.fromUInt(riskFreeRate);
      //TODO use skew for volatility
      bytes16 callsDelta = BlackScholes.getDeltaBytes(
         price,
         ABDKMathQuad.fromUInt(weightedStrikeCall),
         ABDKMathQuad.fromUInt(weightedTimeCall),
         vol,
         rfr,
         Types.Flavor.Call
      );
      bytes16 putsDelta = BlackScholes.getDeltaBytes(
         price,
         ABDKMathQuad.fromUInt(weightedStrikePut),
         ABDKMathQuad.fromUInt(weightedTimePut),
         vol,
         rfr,
         Types.Flavor.Put
      );
      return callsDelta.add(putsDelta);
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
    uint optionPrice = amount < PRBMathUint.scale() ? optionQuote.mul(amount) : optionQuote;
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
      returns (bytes16 quote, bytes16 delta)
  {
      bytes16 bytesAmount = ABDKMathQuad.fromUInt(amount);
      (bytes16 optionQuote, bytes16 delta, uint price) = quotePriceGreeks(optionSeries);
      int8 isNegitive = bytesAmount.cmp(ONE);
      bytes16 optionPrice = isNegitive < 0 ? optionQuote.mul(bytesAmount) : optionQuote;
      bytes16 underlyingPrice = ABDKMathQuad.fromUInt(price);
      // factor in portfolio delta
      // if decreases portfolio delta quote standard bs
      // abs(portfolio delta + new delta) < abs(portfolio delta)
      bytes16 utilization = bytesAmount.div(ABDKMathQuad.fromUInt(totalSupply()));
      bytes16 utilizationPrice = underlyingPrice.mul(utilization);
      quote = optionPrice.cmp(utilizationPrice) > 0 ? utilizationPrice : optionPrice;
  }

  function issueAndWriteOption(
     Types.OptionSeries memory optionSeries,
     uint amount,
     address destroy
  ) public payable returns (uint optionAmount, address series)
  {
    address series = optionRegistry.issue(
       optionSeries.underlying,
       optionSeries.strikeAsset,
       optionSeries.expiration,
       optionSeries.flavor,
       optionSeries.strike
    );
    uint optionAmount = writeOption(series, amount);
    //TODO if destroy address, destroy old option series to reduce gas cost
    return (optionAmount, series);
  }

  function writeOption(
    address seriesAddress,
    uint amount
  )
    public
    payable
    returns (uint)
  {
    Types.OptionSeries memory optionSeries = optionRegistry.getSeriesInfo(seriesAddress);
    require(optionSeries.strikeAsset == strikeAsset, "incorrect strike asset");
    Types.Flavor flavor = optionSeries.flavor;
    address escrowAsset = Types.isCall(flavor) ? underlyingAsset : strikeAsset;
    (bytes16 premiumBytes, bytes16 delta) = quotePriceWithUtilizationGreeks(optionSeries, amount);
    uint premium = OptionsCompute.toUInt(premiumBytes);
    TransferHelper.safeTransferFrom(strikeAsset, msg.sender, address(this), premium);
    uint escrow = Types.isCall(flavor) ? amount : OptionsCompute.computeEscrow(amount, optionSeries.strike, IERC20(strikeAsset).decimals());
    require(IERC20(escrowAsset).universalBalanceOf(address(this)) >= escrow, "Insufficient balance");
    if (IERC20(optionSeries.underlying).isETH()) {
        optionRegistry.open{value : escrow}(seriesAddress, amount);
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
    IERC20(seriesAddress).universalTransfer(msg.sender, amount);
  }
}
