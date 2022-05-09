// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./Protocol.sol";
import "./PriceFeed.sol";
import "./tokens/ERC20.sol";
import "./VolatilityFeed.sol";
import "./utils/ReentrancyGuard.sol";
import "./libraries/BlackScholes.sol";
import "./libraries/CustomErrors.sol";
import "./libraries/SafeTransferLib.sol";
import "./interfaces/IOptionRegistry.sol";
import "./interfaces/IHedgingReactor.sol";
import "./interfaces/IPortfolioValuesFeed.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "hardhat/console.sol";


contract LiquidityPool is
  ERC20,
  Ownable,
  AccessControl,
  ReentrancyGuard,
  Pausable
{
  using PRBMathSD59x18 for int256;
  using PRBMathUD60x18 for uint256;

  ///////////////////////////
  /// immutable variables ///
  ///////////////////////////

  // Protocol management contract
  Protocol public immutable protocol;
  // asset that denominates the strike price
  address public immutable strikeAsset;
  // asset that is used as the reference asset
  address public immutable underlyingAsset;
  // asset that is used for collateral asset
  address public immutable collateralAsset;

  /////////////////////////
  /// dynamic variables ///
  /////////////////////////

  // amount of collateralAsset allocated as collateral
  uint public collateralAllocated;
  // ephemeral liabilities of the pool
  int256 public ephemeralLiabilities;
  // ephemeral delta of the pool
  int256 public ephemeralDelta;

  /////////////////////////////////////
  /// governance settable variables ///
  /////////////////////////////////////

  // buffer of funds to not be used to write new options in case of margin requirements (as percentage - for 20% enter 2000)
  uint public bufferPercentage = 2000;
  // list of addresses for hedging reactors
  address[] public hedgingReactors;
  // max total supply of the lp shares
  uint public maxTotalSupply = type(uint256).max;
  // Maximum discount that an option tilting factor can discount an option price
  uint public maxDiscount = PRBMathUD60x18.SCALE * 10 / 100; // As a percentage. Init at 10%
  // The spread between the bid and ask on the IV skew;
  // Consider making this it's own volatility skew if more flexibility is needed
  uint public bidAskIVSpread;
  // option issuance parameters
  Types.OptionParams public optionParams;
  // riskFreeRate as a percentage PRBMath Float. IE: 3% -> 0.03 * 10**18
  uint public riskFreeRate;
  // handlers who are approved to interact with options functionality
  mapping(address => bool) public handler;
  // max time to allow between oracle updates for an underlying and strike
  uint256 public maxTimeDeviationThreshold;
  // max price difference to allow between oracle updates for an underlying and strike
  uint256 public maxPriceDeviationThreshold;
  
  //////////////////////////
  /// constant variables ///
  //////////////////////////  

  // Access control role identifier
  bytes32 private constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
  // BIPS
  uint256 private constant MAX_BPS = 10_000;
  // value below which delta is not worth hedging due to gas costs
  int256 private constant dustValue = 1e15;

  /////////////////////////
  /// structs && events ///
  /////////////////////////

  struct UtilizationState {
    uint totalOptionPrice; //e18
    int totalDelta; // e18
    uint utilizationPrice; //e18
    bool isDecreased;
    uint deltaTiltFactor; //e18
  }

  event OrderCreated(uint orderId);
  event OrderExecuted(uint orderId);
  event LiquidityAdded(uint amount);
  event StrangleCreated(uint strangleId);
  event Deposit(address recipient, uint strikeAmount, uint shares);
  event Withdraw(address recipient, uint shares,  uint strikeAmount);
  event WriteOption(address series, uint amount, uint premium, uint escrow, address buyer);
  event SettleVault(address series, uint collateralReturned, uint collateralLost, address closer);
  event BuybackOption(address series, uint amount, uint premium, uint escrowReturned, address seller);
  
  constructor
  (
    address _protocol, 
    address _strikeAsset, 
    address _underlyingAsset, 
    address _collateralAsset, 
    uint rfr, 
    string memory name, 
    string memory symbol,
    Types.OptionParams memory _optionParams,
    address adminAddress
  ) ERC20(name, symbol, 18) 
  {
    // Grant admin role to deployer
    _setupRole(ADMIN_ROLE, adminAddress);
    strikeAsset = _strikeAsset;
    riskFreeRate = rfr;
    underlyingAsset = _underlyingAsset;
    collateralAsset = _collateralAsset;
    protocol = Protocol(_protocol);
    optionParams = _optionParams;
  }

  ///////////////
  /// setters ///
  ///////////////

  function pauseContract() external onlyOwner {
    _pause();
  }
  function unpause() external onlyOwner {
    _unpause();
  }
  /**
   * @notice set a new hedging reactor
   * @param _reactorAddress append a new hedging reactor 
   * @dev   only governance can call this function
   */
  function setHedgingReactorAddress(address _reactorAddress) onlyOwner external {
    hedgingReactors.push(_reactorAddress);
    SafeTransferLib.safeApprove(ERC20(collateralAsset), _reactorAddress, type(uint256).max);
  }
  /**
   * @notice remove a new hedging reactor by index
   * @param _index remove a hedging reactor 
   * @dev   only governance can call this function
   */
  function removeHedgingReactorAddress(uint256 _index) onlyOwner external {
    SafeTransferLib.safeApprove(ERC20(collateralAsset), hedgingReactors[_index], 0);
     for(uint i = _index; i < hedgingReactors.length-1; i++){
      hedgingReactors[i] = hedgingReactors[i+1];      
    }
    hedgingReactors.pop();
  }

  /**
    * @notice update all optionParam variables
    */
  function setNewOptionParams(uint128 _newMinCallStrike,uint128 _newMaxCallStrike,uint128 _newMinPutStrike,uint128 _newMaxPutStrike,uint128 _newMinExpiry,uint128 _newMaxExpiry) external onlyOwner {
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
   * @notice update the liquidity pool risk free rate
   * @param _riskFreeRate the risk free rate of the market
  */
  function setRiskFreeRate(uint _riskFreeRate) external onlyOwner {
    riskFreeRate = _riskFreeRate;
  }
  function setMaxTimeDeviationThreshold(uint256 _maxTimeDeviationThreshold) external onlyOwner {
    maxTimeDeviationThreshold = _maxTimeDeviationThreshold;
  }
  function setMaxPriceDeviationThreshold(uint256 _maxPriceDeviationThreshold) external onlyOwner {
    maxPriceDeviationThreshold = _maxPriceDeviationThreshold;
  }
  /**
   * @notice change the status of a handler
   */
  function changeHandler(address _handler, bool auth) external onlyOwner {
        handler[_handler] = auth;
  }
  //////////////////////////////////////////////////////
  /// access-controlled state changing functionality ///
  //////////////////////////////////////////////////////

  /** 
   * @notice function for hedging portfolio delta through external means
   * @param delta the current portfolio delta
   */
  function rebalancePortfolioDelta(int256 delta, uint256 reactorIndex)
    external onlyRole(ADMIN_ROLE) whenNotPaused()
  { 
      if(BlackScholes.abs(delta) > dustValue) {
        IHedgingReactor(hedgingReactors[reactorIndex]).hedgeDelta(delta);
      }
  }

  /**
    @notice adjust the collateral held in a specific vault because of health
    @param lpCollateralDifference amount of collateral taken from or given to the liquidity pool in collateral decimals
    @param addToLpBalance true if collateral is returned to liquidity pool, false if collateral is withdrawn from liquidity pool
  */
  function adjustCollateral(uint256 lpCollateralDifference, bool addToLpBalance) external  {
    IOptionRegistry optionRegistry = getOptionRegistry();
    require(msg.sender == address(optionRegistry));
    // assumes in collateral decimals
    if(addToLpBalance){
      collateralAllocated -= lpCollateralDifference;
    } else {
      SafeTransferLib.safeApprove(ERC20(collateralAsset), address(optionRegistry), lpCollateralDifference);
      collateralAllocated += lpCollateralDifference;
    }
  }

  /**
    @notice closes an oToken vault, returning collateral (minus ITM option expiry value) back to the pool
    @param seriesAddress the address of the oToken vault to close
    @return collatReturned the amount of collateral returned to the liquidity pool.
  */
  function settleVault(address seriesAddress) public onlyRole(ADMIN_ROLE) returns (uint256) {
    IOptionRegistry optionRegistry = getOptionRegistry();  
    // get number of options in vault and collateral returned to recalculate our position without these options
    // returns in collat decimals, collat decimals and e8
    (, uint256 collatReturned, uint256 collatLost, uint256 oTokensAmount) = optionRegistry.settle(seriesAddress);
    emit SettleVault(seriesAddress, collatReturned, collatLost, msg.sender);
    _adjustVariables(collatReturned, 0, 0, false);
    collateralAllocated -= collatLost;
    // assumes in collateral decimals
    return collatReturned;
  }

  function handlerIssue(Types.OptionSeries memory optionSeries) external returns(address) {
    require(handler[msg.sender]);
    // series strike in e18
    return _issue(optionSeries, getOptionRegistry());
  }

  function handlerWriteOption(
    Types.OptionSeries memory optionSeries, 
    address seriesAddress, 
    uint256 amount, 
    IOptionRegistry optionRegistry, 
    uint256 premium,
    int256 delta,
    address recipient
  ) 
    external 
    returns(uint256) 
    {
      require(handler[msg.sender]);
      return _writeOption(
        optionSeries,     // series strike in e8
        seriesAddress,    
        amount,           // in e18
        optionRegistry,   
        premium,          // in collat decimals
        delta,
        _checkBuffer(),    // in e18
        recipient
        );
    }

  function handlerIssueAndWriteOption(    
    Types.OptionSeries memory optionSeries, 
    uint256 amount, 
    uint256 premium,
    int256 delta,
    address recipient
    ) 
    external 
    returns(uint256, address) 
    {
    require(handler[msg.sender]);
    IOptionRegistry optionRegistry = getOptionRegistry();
    // series strike passed in as e18
    address seriesAddress = _issue(optionSeries, optionRegistry);
    // series strike received in e8
    optionSeries = optionRegistry.getSeriesInfo(seriesAddress);
    return (_writeOption(
        optionSeries,     // strike in e8
        seriesAddress, 
        amount,           // in e18
        optionRegistry, 
        premium,          // in collat decimals
        delta,
        _checkBuffer(),    // in e18
        recipient
        ), seriesAddress);
  }
  function handlerBuybackOption(
    Types.OptionSeries memory optionSeries, 
    uint256 amount, 
    IOptionRegistry optionRegistry, 
    address seriesAddress,
    uint256 premium, 
    int256 delta,
    address seller
    ) 
    external 
    returns (uint256) 
    {
    require(handler[msg.sender]);
    // strike passed in as e8
    return _buybackOption(optionSeries, amount, optionRegistry, seriesAddress, premium, delta, seller);
  }

/**
    @notice reset the temporary portfolio and delta values that have been changed since the last oracle update
    @dev    only callable by the portfolio values feed oracle contract
  */
function resetEphemeralValues() external {
    require(msg.sender == address(getPortfolioValuesFeed()));
    delete ephemeralLiabilities;
    delete ephemeralDelta;
}
  /////////////////////////////////////////////
  /// external state changing functionality ///
  /////////////////////////////////////////////

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
    nonReentrant
    returns(uint shares)
  {
    if (_amount == 0) {revert CustomErrors.InvalidAmount();}
    // Calculate shares to mint based on the amount provided
    (shares) = _sharesForAmount(_amount);
    if (shares == 0) {revert CustomErrors.InvalidShareAmount();}
    // Pull in tokens from sender
    SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(this), _amount);
    // mint lp token to recipient
    _mint(_recipient, shares);
    emit Deposit(_recipient, _amount, shares);
    if (totalSupply > maxTotalSupply) {revert CustomErrors.TotalSupplyReached();}
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
    nonReentrant
    returns(uint transferCollateralAmount)
  {
    if (_shares == 0) {revert CustomErrors.InvalidShareAmount();}
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
      // assumes returned in e18
      for (uint8 i=0; i < hedgingReactors.length; i++) {
        amountNeeded -= int(IHedgingReactor(hedgingReactors[i]).withdraw(uint(amountNeeded)));
        if (amountNeeded <= 0) {
          break;
        }
      }
      // if still above zero after withdrawing from hedging reactors, we do not have enough liquidity
      if (amountNeeded > 0) { revert CustomErrors.WithdrawExceedsLiquidity();}
    }
    transferCollateralAmount = OptionsCompute.convertToDecimals(collateralAmount, _decimals);
    // burn the shares
    _burn(msg.sender, _shares);
    // send funds to user
    SafeTransferLib.safeTransfer(ERC20(collateralAsset), _recipient, transferCollateralAmount);
    emit Withdraw(_recipient, _shares, transferCollateralAmount);
  }

  ///////////////////////
  /// complex getters ///
  ///////////////////////

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
   * @notice get the delta of the portfolio
   * @return portfolio delta
   */
  function getPortfolioDelta()
      public
      view
      returns (int256)
  {
      // assumes in e18
      IPortfolioValuesFeed pvFeed = getPortfolioValuesFeed();
      address underlyingAsset_ = underlyingAsset;
      address strikeAsset_ = strikeAsset;
      Types.PortfolioValues memory portfolioValues = pvFeed.getPortfolioValues(underlyingAsset_, strikeAsset_);
      // check that the portfolio values are acceptable
      OptionsCompute.validatePortfolioValues(
        getUnderlyingPrice(underlyingAsset_, strikeAsset_), 
        portfolioValues,
        maxTimeDeviationThreshold,
        maxPriceDeviationThreshold
        );
      // assumes in e18
      int256 externalDelta;
      address[] memory hedgingReactors_ = hedgingReactors;
      for (uint8 i=0; i < hedgingReactors_.length; i++) {
        externalDelta += IHedgingReactor(hedgingReactors_[i]).getDelta();
      }
      return portfolioValues.delta + externalDelta + ephemeralDelta;
  }

  /**
   * @notice get the quote price and delta for a given option
   * @param  optionSeries option type to quote - strike assumed in e18
   * @param  amount the number of options to mint  - assumed in e18
   * @return quote the price of the options - returns in e18
   * @return delta the delta of the options - returns in e18
   */
  function quotePriceWithUtilizationGreeks(
    Types.OptionSeries memory optionSeries,
    uint amount
  )
      public
      view
      returns (uint256 quote, int256 delta)
  {
      // returns quotes for a single option. All denominated in 1e18
      (uint256 optionQuote, int256 deltaQuote, uint underlyingPrice) = quotePriceGreeks(optionSeries, false);
      // using a struct to get around stack too deep issues
      UtilizationState memory quoteState;
      // price of acquiring total amount of options (remains e18 due to PRBMath)
      quoteState.totalOptionPrice = optionQuote.mul(amount);
      quoteState.totalDelta = deltaQuote.mul(int(amount));
      int portfolioDelta = getPortfolioDelta();
      // portfolio delta upon writing option
      // subtract totalDelta because the pool is taking on the negative of the option's delta
      int newDelta = PRBMathSD59x18.abs(portfolioDelta - quoteState.totalDelta);
      // assumes a single collateral type regardless of call or put
      // Is delta decreased?
      quoteState.isDecreased = newDelta < PRBMathSD59x18.abs(portfolioDelta);
      // delta in non-nominal terms
      uint normalizedDelta = uint256(newDelta < 0 ? -newDelta : newDelta).div(_getNAV());
      // max theoretical price of the option
      uint maxPrice = (optionSeries.isPut ? optionSeries.strike : underlyingPrice).mul(amount);

      // ******                                           *******
      // ******   What is this line trying to achieve?    *******
      quoteState.utilizationPrice = maxPrice.mul(quoteState.totalOptionPrice.div(totalSupply));
      // layered on to BlackScholes price when delta is moved away from target
      quoteState.deltaTiltFactor = (maxPrice.mul(normalizedDelta)).div(quoteState.totalOptionPrice);
      if (quoteState.isDecreased) {
        // provide discount for moving towards delta zero
        uint discount = quoteState.deltaTiltFactor > maxDiscount ? maxDiscount : quoteState.deltaTiltFactor;

        // discounted BS option price
        uint newOptionPrice = quoteState.totalOptionPrice - discount.mul(quoteState.totalOptionPrice);
        // discounted utilization priced option
        quoteState.utilizationPrice = quoteState.utilizationPrice - discount.mul(quoteState.utilizationPrice);
        // quote the greater of discounted utilization or discounted BS
        quote = quoteState.utilizationPrice > newOptionPrice ? quoteState.utilizationPrice : newOptionPrice;
      } else {
        uint newOptionPrice = quoteState.deltaTiltFactor.mul(quoteState.totalOptionPrice) + quoteState.totalOptionPrice;
        if (quoteState.utilizationPrice < maxPrice) {
          // increase utilization by delta tilt factor for moving delta away from zero
          quoteState.utilizationPrice = quoteState.deltaTiltFactor.mul(quoteState.utilizationPrice) + quoteState.utilizationPrice;
          quote = quoteState.utilizationPrice > newOptionPrice ? quoteState.utilizationPrice : newOptionPrice;
        } else {
          quote = maxPrice;
        }
      }
      quote =  OptionsCompute.convertToCollateralDenominated(quote, underlyingPrice, optionSeries);
      delta = quoteState.totalDelta;
      //@TODO think about more robust considitions for this check
      if (quote == 0 || delta == int(0)) { revert CustomErrors.DeltaQuoteError(quote, delta);}
  }

  /**
   * @notice get the quote price and delta for a given option
   * @param  optionSeries option type to quote - strike assumed in e18
   * @param  amount the number of options to buy - assumed in e18
   * @return quote the price of the options - assumed in collateral decimals
   * @return delta the delta of the options - assumed in e18
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
      quote =  OptionsCompute.convertToCollateralDenominated(optionQuote.mul(amount), underlyingPrice, optionSeries);
      delta = deltaQuote.mul(int(amount));
      //@TODO think about more robust considitions for this check
      if (quote == 0 || delta == int(0)) { revert CustomErrors.DeltaQuoteError(quote, delta); }
  }

  ///////////////////////////
  /// non-complex getters ///
  ///////////////////////////

  /**
   * @notice get the current implied volatility from the feed
   * @param isPut Is the option a call or put?
   * @param underlyingPrice The underlying price - assumed in e18
   * @param strikePrice The strike price of the option - assumed in e18
   * @param expiration expiration timestamp of option as a PRBMath Float
   * @return Implied volatility adjusted for volatility surface - assumed in e18
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
      return getVolatilityFeed().getImpliedVolatility(isPut, underlyingPrice, strikePrice, expiration);
    }

  function getNAV() external view returns (uint) {
    return _getNAV();
  }
  //////////////////////////
  /// internal utilities ///
  //////////////////////////

  /**
   * @notice get the number of shares for a given amount
   * @param _amount  the amount to convert to shares - assumed in collateral decimals
   * @return shares the number of shares based on the amount - assumed in e18
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
      shares = convertedAmount.mul(totalSupply).div(_getNAV());
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
    // cache
    address underlyingAsset_ = underlyingAsset;
    address strikeAsset_ = strikeAsset;
    address collateralAsset_ = collateralAsset;
    // equities = assets - liabilities
    // assets: Any token such as eth usd, collateral sent to OptionRegistry, hedging reactor stuff in e18
    // liabilities: Options that we wrote in e18
    uint256 assets = 
      OptionsCompute.convertFromDecimals(IERC20(collateralAsset_).balanceOf(address(this)), IERC20(collateralAsset_).decimals()) 
      + OptionsCompute.convertFromDecimals(collateralAllocated, IERC20(collateralAsset_).decimals());
    address[] memory hedgingReactors_ = hedgingReactors;
    for (uint8 i=0; i < hedgingReactors_.length; i++) {
      // should always return value in e18 decimals
       assets += IHedgingReactor(hedgingReactors_[i]).getPoolDenominatedValue();
    }
    IPortfolioValuesFeed pvFeed = getPortfolioValuesFeed();
    Types.PortfolioValues memory portfolioValues = pvFeed.getPortfolioValues(underlyingAsset_, strikeAsset_);
    // check that the portfolio values are acceptable
    OptionsCompute.validatePortfolioValues(
        getUnderlyingPrice(underlyingAsset_, strikeAsset_), 
        portfolioValues,
        maxTimeDeviationThreshold,
        maxPriceDeviationThreshold
        );
    int256 ephemeralLiabilities_ = ephemeralLiabilities;
    // ephemeralLiabilities can be -ve but portfolioValues will not
    // when converting liabilities it should never be -ve, if it is then the NAV calc will fail
    uint256 liabilities = portfolioValues.callPutsValue + (ephemeralLiabilities_ > 0 ? uint256(ephemeralLiabilities_) : uint256(-ephemeralLiabilities_));
    return assets - liabilities;
  }

  /**
   * @notice get the amount for a given number of shares
   * @param _shares  the shares to convert to amount in e18
   * @return amount the number of amount based on shares in e18
   */
  function _shareValue(uint _shares)
    internal
    view
    returns (uint amount)
  {
    if (totalSupply == 0) {
      amount = _shares;
    } else {
      amount = _shares.mul(_getNAV()).div(totalSupply);
    }
  }

  /**
   * @notice get the greeks of a quotePrice for a given optionSeries
   * @param  optionSeries Types.OptionSeries struct for describing the option to price greeks - strike in e18
   * @return quote           Quote price of the option - in e18
   * @return delta           delta of the option being priced - in e18
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
      underlyingPrice = getUnderlyingPrice(optionSeries.underlying, optionSeries.strikeAsset);
      uint iv = getImpliedVolatility(optionSeries.isPut, underlyingPrice, optionSeries.strike, optionSeries.expiration);
      if (iv == 0) {revert CustomErrors.IVNotFound();}
      if (isBuying) {
        iv = iv - bidAskIVSpread;
      }
      // revert CustomErrors.if the expiry is in the past
      if (optionSeries.expiration <= block.timestamp) {revert CustomErrors.OptionExpiryInvalid();}
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
   * @notice calculates amount of liquidity that can be used before hitting buffer
   * @return bufferRemaining the amount of liquidity available before reaching buffer in e18
  */
  function _checkBuffer() view internal returns(int256 bufferRemaining){ 
    // calculate max amount of liquidity pool funds that can be used before reaching max buffer allowance
    (uint256 normalizedCollateralBalance,,) = getNormalizedBalance(collateralAsset);
    bufferRemaining = int256(normalizedCollateralBalance - _getNAV() * bufferPercentage/MAX_BPS);
    // revert CustomErrors.if buffer allowance already hit
    if(bufferRemaining <= 0) {revert CustomErrors.MaxLiquidityBufferReached();}
  }

  /**
   * @notice create the option contract in the options registry
   * @param  optionSeries option type to mint - option series strike in e18
   * @param  optionRegistry interface for the options issuer
   * @return series the address of the option series minted
   */
  function _issue(Types.OptionSeries memory optionSeries, IOptionRegistry optionRegistry) internal returns (address series) {
    // make sure option is being issued with correct assets
    if(optionSeries.collateral != collateralAsset) { revert CustomErrors.CollateralAssetInvalid();}
    if(optionSeries.underlying != underlyingAsset) { revert CustomErrors.UnderlyingAssetInvalid();}
    if(optionSeries.strikeAsset != strikeAsset) { revert CustomErrors.StrikeAssetInvalid();}
    // cache
    Types.OptionParams memory optionParams_ = optionParams;
    // check the expiry is within the allowed bounds
    if (block.timestamp + optionParams_.minExpiry > optionSeries.expiration || optionSeries.expiration > block.timestamp + optionParams_.maxExpiry) {revert CustomErrors.OptionExpiryInvalid();}
    // check that the option strike is within the range of the min and max acceptable strikes of calls and puts
    if(optionSeries.isPut){
      if (optionParams_.minPutStrikePrice > optionSeries.strike || optionSeries.strike > optionParams_.maxPutStrikePrice) {revert CustomErrors.OptionStrikeInvalid();}
    } else {
      if (optionParams_.minCallStrikePrice > optionSeries.strike || optionSeries.strike > optionParams_.maxCallStrikePrice) {revert CustomErrors.OptionStrikeInvalid();}
    }
    // issue the option from the option registry (its characteristics will be stored in the optionsRegistry)
    series = optionRegistry.issue(
       optionSeries
    );
    if (series == address(0)) {revert CustomErrors.IssuanceFailed();}
  }

  /**
   * @notice write a number of options for a given OptionSeries
   * @param  optionSeries option type to mint - strike in e8
   * @param  seriesAddress the address of the options series
   * @param  amount the amount to be written - in e18
   * @param  optionRegistry the option registry of the pool
   * @param  premium the premium to charge the user - in collateral decimals
   * @param  delta the delta of the option position - in e18
   * @param  bufferRemaining the amount of buffer that can be used - in e18
   * @return the amount that was written
   */
  function _writeOption(
    Types.OptionSeries memory optionSeries, 
    address seriesAddress, 
    uint256 amount, 
    IOptionRegistry optionRegistry, 
    uint256 premium,
    int256 delta,
    int256 bufferRemaining,
    address recipient
    ) internal returns (uint256) {
    // strike decimals come into this function as e8
    uint256 collateralAmount = optionRegistry.getCollateral(optionSeries, amount);
    if (uint(bufferRemaining) < OptionsCompute.convertFromDecimals(collateralAmount, IERC20(collateralAsset).decimals())) {revert CustomErrors.MaxLiquidityBufferReached();}
    IERC20(collateralAsset).approve(address(optionRegistry), collateralAmount);
    (, collateralAmount) = optionRegistry.open(seriesAddress, amount, collateralAmount);
    emit WriteOption(seriesAddress, amount, premium, collateralAmount, recipient);
    // convert e8 strike to e18 strike
    optionSeries.strike = uint128(OptionsCompute.convertFromDecimals(optionSeries.strike, ERC20(seriesAddress).decimals()));
    _adjustVariables(collateralAmount, premium, delta, true);
    SafeTransferLib.safeTransfer(ERC20(seriesAddress), recipient, OptionsCompute.convertToDecimals(amount, IERC20(seriesAddress).decimals()));
    // returns in e18
    return amount;
  }

  /**
    @notice buys a number of options back and burns the tokens
    @param optionSeries the option token series to buyback - strike passed in as e8
    @param amount the number of options to buyback expressed in 1e18
    @param optionRegistry the registry
    @param seriesAddress the series being sold
    @param premium the premium to be sent back to the owner (in collat decimals)
    @param delta the delta of the option
    @param seller the address 
    @return the number of options burned in e18
  */
  function _buybackOption(
    Types.OptionSeries memory optionSeries,
    uint amount,
    IOptionRegistry optionRegistry,
    address seriesAddress,
    uint premium,
    int256 delta,
    address seller
  )
  internal 
  returns (uint256) 
  {
    SafeTransferLib.safeApprove(ERC20(seriesAddress), address(optionRegistry), OptionsCompute.convertToDecimals(amount, IERC20(seriesAddress).decimals()));
    (, uint collateralReturned) = optionRegistry.close(seriesAddress, amount);
    emit BuybackOption(seriesAddress, amount, premium, collateralReturned, seller);
    // convert e8 strike to e18 strike
    optionSeries.strike = uint128(OptionsCompute.convertFromDecimals(optionSeries.strike, ERC20(seriesAddress).decimals()));
    _adjustVariables(collateralReturned, premium, delta, false);
    SafeTransferLib.safeTransfer(ERC20(collateralAsset), seller, premium);
    return amount;
  }

  /**
   * @notice adjust the variables of the pool
   * @param  collateralAmount the amount of collateral transferred to change on collateral allocated in collateral decimals
   * @param  isSale whether the action was an option sale or not
   */
 function _adjustVariables(
   uint256 collateralAmount, 
   uint256 optionsValue,
   int256 delta,
   bool isSale
   ) internal {
    if (isSale) {
        collateralAllocated += collateralAmount;
        ephemeralLiabilities += int256(OptionsCompute.convertFromDecimals(optionsValue, ERC20(collateralAsset).decimals()));
        ephemeralDelta -= delta;
    } else {
        collateralAllocated -= collateralAmount;
        ephemeralLiabilities -= int256(OptionsCompute.convertFromDecimals(optionsValue, ERC20(collateralAsset).decimals()));
        ephemeralDelta += delta;
    }
  }

  /**
   * @notice get the volatility feed used by the liquidity pool
   * @return the volatility feed contract interface
   */
  function getVolatilityFeed() internal view returns (VolatilityFeed) {
    return VolatilityFeed(protocol.volatilityFeed());
  }
  
  /**
   * @notice get the portfolio values feed used by the liquidity pool
   * @return the portfolio values feed contract
   */
  function getPortfolioValuesFeed() internal view returns (IPortfolioValuesFeed) {
    return IPortfolioValuesFeed(protocol.portfolioValuesFeed());
  }

  /**
   * @notice get the option registry used for storing and managing the options
   * @return the option registry contract
   */
  function getOptionRegistry() internal view returns (IOptionRegistry) {
    return IOptionRegistry(protocol.optionRegistry());
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
    return PriceFeed(protocol.priceFeed()).getNormalizedRate(
      underlying,
      _strikeAsset
    );
  }

}
