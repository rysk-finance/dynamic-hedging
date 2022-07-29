// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./Protocol.sol";

import "./tokens/ERC20.sol";
import "./libraries/Types.sol";
import "./utils/ReentrancyGuard.sol";
import "./libraries/CustomErrors.sol";
import "./libraries/AccessControl.sol";
import "./libraries/OptionsCompute.sol";
import "./libraries/SafeTransferLib.sol";

import "./interfaces/ILiquidityPool.sol";
import "./interfaces/IOptionRegistry.sol";
import "./interfaces/IPortfolioValuesFeed.sol";

import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";

/**
 *  @title Contract used for all user facing options interactions
 *  @dev Interacts with liquidityPool to write options and quote their prices.
 */
contract AlphaOptionHandler is AccessControl, ReentrancyGuard {
	using PRBMathSD59x18 for int256;
	using PRBMathUD60x18 for uint256;

	///////////////////////////
	/// immutable variables ///
	///////////////////////////

	// Protocol management contracts
	ILiquidityPool public immutable liquidityPool;
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

	// order id counter
	uint256 public orderIdCounter;
	// custom option orders
	mapping(uint256 => Types.Order) public orderStores;

	/////////////////////////////////////
	/// governance settable variables ///
	/////////////////////////////////////

	// settings for the limits of a custom order
	CustomOrderBounds public customOrderBounds = CustomOrderBounds(0, 25e16, -25e16, 0, 1000);

	//////////////////////////
	/// constant variables ///
	//////////////////////////

	// BIPS
	uint256 private constant MAX_BPS = 10_000;
	// custom order maximum time for liveness
	uint256 private constant maxOrderExpiry = 1800;

	/////////////////////////
	/// structs && events ///
	/////////////////////////

	// delta and price boundaries for custom orders
	struct CustomOrderBounds {
		uint128 callMinDelta; // call delta will always be between 0 and 1 (e18)
		uint128 callMaxDelta; // call delta will always be between 0 and 1 (e18)
		int128 putMinDelta; // put delta will always be between 0 and -1 (e18)
		int128 putMaxDelta; // put delta will always be between 0 and -1 (e18)
		// maxPriceRange is the maximum percentage below the LP calculated price,
		// measured in BPS, that the order may be sold for. 10% would mean maxPriceRange = 1000
		uint32 maxPriceRange;
	}

	event OrderCreated(uint256 orderId);
	event OrderExecuted(uint256 orderId);

	constructor(
		address _authority,
		address _protocol,
		address _liquidityPool
	) AccessControl(IAuthority(_authority)) {
		protocol = Protocol(_protocol);
		liquidityPool = ILiquidityPool(_liquidityPool);
		collateralAsset = liquidityPool.collateralAsset();
		underlyingAsset = liquidityPool.underlyingAsset();
		strikeAsset = liquidityPool.strikeAsset();
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
	function setCustomOrderBounds(
		uint128 _callMinDelta,
		uint128 _callMaxDelta,
		int128 _putMinDelta,
		int128 _putMaxDelta,
		uint32 _maxPriceRange
	) external {
		_onlyGovernor();
		customOrderBounds.callMinDelta = _callMinDelta;
		customOrderBounds.callMaxDelta = _callMaxDelta;
		customOrderBounds.putMinDelta = _putMinDelta;
		customOrderBounds.putMaxDelta = _putMaxDelta;
		customOrderBounds.maxPriceRange = _maxPriceRange;
	}

	//////////////////////////////////////////////////////
	/// access-controlled state changing functionality ///
	//////////////////////////////////////////////////////

	/**
	 * @notice creates an order for a number of options from the pool to a specified user. The function
	 *      is intended to be used to issue options to market makers/ OTC market participants
	 *      in order to have flexibility and customisability on option issuance and market
	 *      participant UX.
	 * @param _optionSeries the option token series to issue - strike in e18
	 * @param _amount the number of options to issue - e18
	 * @param _price the price per unit to issue at - in e18
	 * @param _orderExpiry the expiry of the custom order, after which the 
	 *        buyer cannot use this order (if past the order is redundant)
	 * @param _buyerAddress the agreed upon buyer address
	 * @return orderId the unique id of the order
	 */
	function createOrder(
		Types.OptionSeries memory _optionSeries,
		uint256 _amount,
		uint256 _price,
		uint256 _orderExpiry,
		address _buyerAddress
	) public returns (uint256) {
		_onlyManager();
		if (_price == 0) {
			revert CustomErrors.InvalidPrice();
		}
		if (_orderExpiry > maxOrderExpiry) {
			revert CustomErrors.OrderExpiryTooLong();
		}
		IOptionRegistry optionRegistry = getOptionRegistry();
		// issue the option type, all checks of the option validity should happen in _issue
		address series = liquidityPool.handlerIssue(_optionSeries);
		// create the order struct, setting the series, amount, price, order expiry and buyer address
		Types.Order memory order = Types.Order(
			optionRegistry.getSeriesInfo(series), // strike in e8
			_amount, // amount in e18
			_price, // in e18
			block.timestamp + _orderExpiry,
			_buyerAddress,
			series
		);
		uint256 orderIdCounter__ = orderIdCounter + 1;
		// increment the orderId and store the order
		orderStores[orderIdCounter__] = order;
		emit OrderCreated(orderIdCounter__);
		orderIdCounter = orderIdCounter__;
		return orderIdCounter__;
	}

	/**
	 * @notice creates a strangle order. One custom put and one custom call order to be executed simultaneously.
	 * @param _optionSeriesCall the option token series to issue for the call part of the strangle - strike in e18
	 * @param _optionSeriesPut the option token series to issue for the put part of the strangle - strike in e18
	 * @param _amountCall the number of call options to issue
	 * @param _amountPut the number of put options to issue
	 * @param _priceCall the price per unit to issue calls at
	 * @param _pricePut the price per unit to issue puts at
	 * @param _orderExpiry the expiry of the order (if past the order is redundant)
	 * @param _buyerAddress the agreed upon buyer address
	 * @return putOrderId the unique id of the put part of the strangle
	 * @return callOrderId the unique id of the call part of the strangle
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
	) external returns (uint256, uint256) {
		_onlyManager();
		uint256 callOrderId = createOrder(
			_optionSeriesCall,
			_amountCall,
			_priceCall,
			_orderExpiry,
			_buyerAddress
		);
		uint256 putOrderId = createOrder(
			_optionSeriesPut,
			_amountPut,
			_pricePut,
			_orderExpiry,
			_buyerAddress
		);
		return (putOrderId, callOrderId);
	}

	/**
	 * @notice fulfills an order for a number of options from the pool to a specified user. The function
	 *      is intended to be used to issue options to market makers/ OTC market participants
	 *      in order to have flexibility and customisability on option issuance and market
	 *      participant UX.
	 * @param  _orderId the id of the order for options purchase
	 */
	function executeOrder(uint256 _orderId) public nonReentrant {
		// get the order
		Types.Order memory order = orderStores[_orderId];
		// check that the sender is the authorised buyer of the order
		if (msg.sender != order.buyer) {
			revert CustomErrors.InvalidBuyer();
		}
		// check that the order is still valid
		if (block.timestamp > order.orderExpiry) {
			revert CustomErrors.OrderExpired();
		}
		// calculate the total premium
		uint256 premium = (order.amount * order.price) / 1e18;

		/// TODO: Could compute delta but is unnecessary so could potentially leave as 0 to save on gas
		int256 delta = 0;

		address collateralAsset_ = collateralAsset;
		uint256 convertedPrem = OptionsCompute.convertToDecimals(
			premium,
			ERC20(collateralAsset_).decimals()
		);
		// premium needs to adjusted for decimals of collateral asset
		SafeTransferLib.safeTransferFrom(
			collateralAsset_,
			msg.sender,
			address(liquidityPool),
			convertedPrem
		);
		// write the option contract, includes sending the premium from the user to the pool, option series should be in e8
		liquidityPool.handlerWriteOption(
			order.optionSeries,
			order.seriesAddress,
			order.amount,
			getOptionRegistry(),
			convertedPrem,
			delta,
			msg.sender
		);
		// convert the strike to e18 decimals for storage
		Types.OptionSeries memory seriesToStore = Types.OptionSeries(
			order.optionSeries.expiration,
			uint128(OptionsCompute.convertFromDecimals(order.optionSeries.strike,  8)),
			order.optionSeries.isPut,
			underlyingAsset,
			strikeAsset,
			collateralAsset
		);
		getPortfolioValuesFeed().updateStores(seriesToStore, order.amount, false, order.seriesAddress);
		emit OrderExecuted(_orderId);
		// invalidate the order
		delete orderStores[_orderId];
	}

	/**
	 * @notice fulfills a stored strangle order consisting of a stores call and a stored put.
	 * This is intended to be called by market makers/OTC market participants.
	 */
	function executeStrangle(uint256 _orderId1, uint256 _orderId2) external {
		executeOrder(_orderId1);
		executeOrder(_orderId2);
	}

	/////////////////////////////////////////////
	/// external state changing functionality ///
	/////////////////////////////////////////////

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

	/**
	 * @notice get the portfolio values feed used by the liquidity pool
	 * @return the portfolio values feed contract
	 */
	function getPortfolioValuesFeed() internal view returns (IPortfolioValuesFeed) {
		return IPortfolioValuesFeed(protocol.portfolioValuesFeed());
	}
}
