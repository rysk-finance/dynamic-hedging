pragma solidity >=0.8.0;

import "./Protocol.sol";
import "./tokens/ERC20.sol";
import "./utils/ReentrancyGuard.sol";
import "./libraries/CustomErrors.sol";
import "./libraries/SafeTransferLib.sol";
import "./interfaces/ILiquidityPool.sol";
import "./interfaces/IOptionRegistry.sol";
import { Types } from "./libraries/Types.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import { OptionsCompute } from "./libraries/OptionsCompute.sol";


contract OptionHandler is
  Pausable,
  Ownable,
  AccessControl,
  ReentrancyGuard
{
  using PRBMathSD59x18 for int256;
  using PRBMathUD60x18 for uint256;

  ///////////////////////////
  /// immutable variables ///
  ///////////////////////////

  // Protocol management contract
  ILiquidityPool public immutable liquidityPool;
  Protocol public immutable protocol;
  address public immutable collateralAsset;

  /////////////////////////
  /// dynamic variables ///
  /////////////////////////

  // order id counter
  uint256 public orderIdCounter;
  // custom option orders
  mapping(uint256 => Types.Order) public orderStores;

  /////////////////////////////////////
  /// governance settable variables ///
  /////////////////////////////////////

  // settings for the limits of a custom order
  CustomOrderBounds public customOrderBounds = CustomOrderBounds(0, 25e16, -25e16, 0, 1000);
  // addresses that are whitelisted to sell options back to the protocol
  mapping(address => bool) public buybackWhitelist;

  //////////////////////////
  /// constant variables ///
  //////////////////////////  

  // Access control role identifier
  bytes32 private constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
  // BIPS
  uint256 private constant MAX_BPS = 10_000;

  /////////////////////////
  /// structs && events ///
  /////////////////////////

  // delta and price boundaries for custom orders
  struct CustomOrderBounds {
    uint128 callMinDelta;     // call delta will always be between 0 and 1 (e18)
    uint128 callMaxDelta;     // call delta will always be between 0 and 1 (e18)
    int128 putMinDelta;       // put delta will always be between 0 and -1 (e18)
    int128 putMaxDelta;       // put delta will always be between 0 and -1 (e18)
    // maxPriceRange is the maximum percentage below the LP calculated price,
    // measured in BPS, that the order may be sold for. 10% would mean maxPriceRange = 1000
    uint32 maxPriceRange;
  }

  event OrderCreated(uint orderId);
  event OrderExecuted(uint orderId);
  event StrangleCreated(uint strangleId);
  
  constructor
  (
    address adminAddress,
    address _protocol,
    address _liquidityPool
  ) 
  {
    // Grant admin role to deployer
    _setupRole(ADMIN_ROLE, adminAddress);
    protocol = Protocol(_protocol);
    liquidityPool = ILiquidityPool(_liquidityPool);
    collateralAsset = liquidityPool.collateralAsset();
  }

  ///////////////
  /// setters ///
  ///////////////

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
  ) onlyOwner external {
    customOrderBounds.callMinDelta = _callMinDelta;
    customOrderBounds.callMaxDelta = _callMaxDelta;
    customOrderBounds.putMinDelta = _putMinDelta;
    customOrderBounds.putMaxDelta = _putMaxDelta;
    customOrderBounds.maxPriceRange = _maxPriceRange;
  }
  function pauseContract() external onlyOwner{
    _pause();
  }
  function unpause() external onlyOwner{
    _unpause();
  }

  function addOrRemoveBuybackAddress(address _addressToWhitelist, bool toAdd) external onlyOwner {
    buybackWhitelist[_addressToWhitelist] = toAdd;
  }
  //////////////////////////////////////////////////////
  /// access-controlled state changing functionality ///
  //////////////////////////////////////////////////////

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
    if (_price == 0) {revert CustomErrors.InvalidPrice();}
    if (_orderExpiry > 1800) {revert CustomErrors.OrderExpiryTooLong();}

    // issue the option type, all checks of the option validity should happen in _issue
    address series = liquidityPool.handlerIssue(_optionSeries, getOptionRegistry());
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
  ) external onlyRole(ADMIN_ROLE) returns (uint, uint) 
  {
    uint callOrderId = createOrder(_optionSeriesCall, _amountCall, _priceCall, _orderExpiry, _buyerAddress);
    uint putOrderId = createOrder(_optionSeriesPut, _amountPut, _pricePut, _orderExpiry, _buyerAddress);
    return (putOrderId, callOrderId);
  }

  /**
    @notice fulfills an order for a number of options from the pool to a specified user. The function
            is intended to be used to issue options to market makers/ OTC market participants
            in order to have flexibility and customisability on option issuance and market 
            participant UX.
    @param  _orderId the id of the order for options purchase
  */
  function executeOrder(uint256 _orderId) public nonReentrant {
    // get the order
    Types.Order memory order = orderStores[_orderId];
    // check that the sender is the authorised buyer of the order
    if(msg.sender != order.buyer) {revert CustomErrors.InvalidBuyer();}
    // check that the order is still valid
    if(block.timestamp > order.orderExpiry) {revert CustomErrors.OrderExpired();}
    IOptionRegistry optionRegistry = getOptionRegistry();  
    Types.OptionSeries memory optionSeries = optionRegistry.getSeriesInfo(order.seriesAddress);
    (uint poolCalculatedPremium, int delta) = liquidityPool.quotePriceWithUtilizationGreeks(Types.OptionSeries( 
       optionSeries.expiration,
       optionSeries.isPut,
       OptionsCompute.convertFromDecimals(optionSeries.strike, ERC20(order.seriesAddress).decimals()), // convert from 1e8 to 1e18 notation for quotePrice
       optionSeries.underlying,
       optionSeries.strikeAsset,
       collateralAsset), order.amount);
    
    // calculate the total premium
    uint256 premium = (order.amount * order.price) / 1e18;
    // check the agreed upon premium is within acceptable range of pool's own pricing model
    if (poolCalculatedPremium - (poolCalculatedPremium *  customOrderBounds.maxPriceRange / MAX_BPS) > premium) { revert CustomErrors.CustomOrderInsufficientPrice(); }
    // check that the delta values of the options are within acceptable ranges
    // if isPut, delta will always be between 0 and -1e18
    if(optionSeries.isPut){
      if (customOrderBounds.putMinDelta > delta || delta > customOrderBounds.putMaxDelta) { revert CustomErrors.CustomOrderInvalidDeltaValue(); }
    } else {
      if (customOrderBounds.callMinDelta > uint(delta) || uint(delta) > customOrderBounds.callMaxDelta) { revert CustomErrors.CustomOrderInvalidDeltaValue(); }
    }
    // premium needs to adjusted for decimals of collateral asset
    SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(liquidityPool), OptionsCompute.convertToDecimals(premium, ERC20(collateralAsset).decimals()));
    // write the option contract, includes sending the premium from the user to the pool
    uint256 written = liquidityPool.handlerWriteOption(order.optionSeries, order.seriesAddress, order.amount, optionRegistry, premium, msg.sender);
    emit OrderExecuted(_orderId);
    // invalidate the order
    delete orderStores[_orderId];
  }

  /**
    @notice fulfills a stored strangle order consisting of a stores call and a stored put.
    This is intended to be called by market makers/OTC market participants.
  */
  function executeStrangle(uint256 _orderId1, uint256 _orderId2) external {
    executeOrder(_orderId1);
    executeOrder(_orderId2);
  }

  /////////////////////////////////////////////
  /// external state changing functionality ///
  /////////////////////////////////////////////

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
    nonReentrant
    returns (uint optionAmount, address series)
  {
    IOptionRegistry optionRegistry = getOptionRegistry();
    series = liquidityPool.handlerIssue(optionSeries, optionRegistry);
    // calculate premium
    (uint256 premium, int256 delta) = liquidityPool.quotePriceWithUtilizationGreeks(optionSeries, amount);
    // premium needs to adjusted for decimals of collateral asset
    SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(liquidityPool), OptionsCompute.convertToDecimals(premium, ERC20(collateralAsset).decimals()));
    //write the option
    optionAmount = liquidityPool.handlerWriteOption(optionSeries, series, amount, optionRegistry, premium, msg.sender);
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
    nonReentrant
    returns (uint256)
  {
    IOptionRegistry optionRegistry = getOptionRegistry();
    // get the option series from the pool
    Types.OptionSeries memory optionSeries = optionRegistry.getSeriesInfo(seriesAddress);
    // calculate premium
    (uint256 premium, int256 delta) = liquidityPool.quotePriceWithUtilizationGreeks(optionSeries, amount);
    // premium needs to adjusted for decimals of collateral asset
    SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(liquidityPool), OptionsCompute.convertToDecimals(premium, ERC20(collateralAsset).decimals()));
    return liquidityPool.handlerWriteOption(optionSeries, seriesAddress, amount, optionRegistry, premium, msg.sender);
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
  ) 
  public 
  nonReentrant 
  whenNotPaused() 
  returns (uint256)
  {
    // revert if the expiry is in the past
    if (optionSeries.expiration <= block.timestamp) {revert CustomErrors.OptionExpiryInvalid();}
    (uint256 premium, int256 delta) = liquidityPool.quotePriceBuying(optionSeries, amount);
    if (!buybackWhitelist[msg.sender]){
      int portfolioDelta = liquidityPool.getPortfolioDelta();
      int newDelta = PRBMathSD59x18.abs(portfolioDelta + delta);
      bool isDecreased = newDelta < PRBMathSD59x18.abs(portfolioDelta);
      if (!isDecreased) {revert CustomErrors.DeltaNotDecreased();}
    }
    IOptionRegistry optionRegistry = getOptionRegistry();  
    address seriesAddress = optionRegistry.getOtoken(
       optionSeries.underlying,
       optionSeries.strikeAsset,
       optionSeries.expiration,
       optionSeries.isPut,
       optionSeries.strike,
       collateralAsset
    );     
    if (seriesAddress == address(0)) {revert CustomErrors.NonExistentOtoken();} 
    SafeTransferLib.safeTransferFrom(seriesAddress, msg.sender, address(liquidityPool), OptionsCompute.convertToDecimals(amount, ERC20(seriesAddress).decimals()));
    return liquidityPool.handlerBuybackOption(optionSeries, amount, optionRegistry, seriesAddress, premium, msg.sender);
  }

  ///////////////////////////
  /// non-complex getters ///
  ///////////////////////////

  /**
   * @notice get the option registry used for storing and managing the options
   * @return the option registry contract
   */
  function getOptionRegistry() internal view returns (IOptionRegistry) {
    return IOptionRegistry(protocol.optionRegistry());
  }
}
