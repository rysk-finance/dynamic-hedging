// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./Protocol.sol";
import "./PriceFeed.sol";
import "./OptionCatalogue.sol";

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
	/// @notice option catalogue
	OptionCatalogue public catalogue;


	/////////////////////////////////////
	/// governance settable variables ///
	/////////////////////////////////////

	uint256 public feePerContract = 1e5;
	address public feeRecipient;

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

	event OrderCreated(uint256 orderId);
	event OrderExecuted(uint256 orderId);

	constructor(
		address _authority,
		address _protocol,
		address _liquidityPool,
		address _catalogue
	) AccessControl(IAuthority(_authority)) {
		protocol = Protocol(_protocol);
		liquidityPool = ILiquidityPool(_liquidityPool);
		collateralAsset = liquidityPool.collateralAsset();
		underlyingAsset = liquidityPool.underlyingAsset();
		strikeAsset = liquidityPool.strikeAsset();
		feeRecipient = _liquidityPool;
		catalogue = OptionCatalogue(_catalogue);
	}

	function setFeePerContract(uint256 _feePerContract) external {
		_onlyGovernor();
		feePerContract = _feePerContract;
	}

	function setFeeRecipient(address _feeRecipient) external {
		_onlyGovernor();
		require(_feeRecipient != address(0));
		feeRecipient = _feeRecipient;
	}

	function setOptionCatalogue(address _catalogue) external {
		_onlyGovernor();
		catalogue = OptionCatalogue(_catalogue);
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
	 * @param _isBuyBack whether the order being created is buy back
	 * @param _spotMovementRange min and max amount that the spot price can move during the order
	 * @return orderId the unique id of the order
	 */
	function createOrder(
		Types.OptionSeries memory _optionSeries,
		uint256 _amount,
		uint256 _price,
		uint256 _orderExpiry,
		address _buyerAddress,
		bool _isBuyBack,
		uint256[2] memory _spotMovementRange
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
		uint256 spotPrice = _getUnderlyingPrice(underlyingAsset, strikeAsset);
		// create the order struct, setting the series, amount, price, order expiry and buyer address
		Types.Order memory order = Types.Order(
			optionRegistry.getSeriesInfo(series), // strike in e8
			_amount, // amount in e18
			_price, // in e18
			block.timestamp + _orderExpiry,
			_buyerAddress,
			series,
			uint128(spotPrice - _spotMovementRange[0]),
			uint128(spotPrice + _spotMovementRange[1]),
			_isBuyBack
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
	 * @param _callSpotMovementRange min and max amount that the spot price can move during the order for the call
	 * @param _putSpotMovementRange min and max amount that the spot price can move during the order for the call
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
		address _buyerAddress,
		uint256[2] memory _callSpotMovementRange,
		uint256[2] memory _putSpotMovementRange
	) external returns (uint256, uint256) {
		_onlyManager();
		uint256 callOrderId = createOrder(
			_optionSeriesCall,
			_amountCall,
			_priceCall,
			_orderExpiry,
			_buyerAddress,
			false,
			_callSpotMovementRange
		);
		uint256 putOrderId = createOrder(
			_optionSeriesPut,
			_amountPut,
			_pricePut,
			_orderExpiry,
			_buyerAddress,
			false,
			_putSpotMovementRange
		);
		return (putOrderId, callOrderId);
	}

	/////////////////////////////////////////////
	/// external state changing functionality ///
	/////////////////////////////////////////////

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
		// check if the order is a buyback order
		if (order.isBuyBack) {
			revert CustomErrors.InvalidOrder();
		}
		uint256 spotPrice = _getUnderlyingPrice(underlyingAsset, strikeAsset);
		// If spot price has deviated too much we want to void the order
		if (order.lowerSpotMovementRange > spotPrice || order.upperSpotMovementRange < spotPrice) {
			revert CustomErrors.SpotMovedBeyondRange();
		}
		// calculate the total premium
		uint256 premium = order.amount.mul(order.price);

		uint256 convertedPrem = OptionsCompute.convertToDecimals(
			premium,
			ERC20(collateralAsset).decimals()
		);
		// apply fees (it is assumed that in otc trades fees are already accounted for so we subtract)
		uint256 expectedFee = feePerContract.mul(order.amount);
		if ((convertedPrem >> 3) > expectedFee) {
			SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, feeRecipient, expectedFee);
			convertedPrem -= expectedFee;
		}
		// premium needs to adjusted for decimals of collateral asset
		SafeTransferLib.safeTransferFrom(
			collateralAsset,
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
			0, // delta is not used in the liquidityPool unless the oracle implementation is used, so can be set to 0
			msg.sender
		);
		// convert the strike to e18 decimals for storage
		Types.OptionSeries memory seriesToStore = Types.OptionSeries(
			order.optionSeries.expiration,
			uint128(OptionsCompute.convertFromDecimals(order.optionSeries.strike, 8)),
			order.optionSeries.isPut,
			underlyingAsset,
			strikeAsset,
			collateralAsset
		);
		catalogue.updateNetDhvExposureWithOptionSeries(seriesToStore, -int256(order.amount));
		getPortfolioValuesFeed().updateStores(
			seriesToStore,
			int256(order.amount),
			0,
			order.seriesAddress
		);
		emit OrderExecuted(_orderId);
		// invalidate the order
		delete orderStores[_orderId];
	}

	/**
	 * @notice fulfills a buyback order for a number of options from the pool to a specified user. The function
	 *      is intended to be used to issue options to market makers/ OTC market participants
	 *      in order to have flexibility and customisability on option issuance and market
	 *      participant UX.
	 * @param  _orderId the id of the order for options purchase
	 */
	function executeBuyBackOrder(uint256 _orderId) public nonReentrant {
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
		// check if the order is a buyback order
		if (!order.isBuyBack) {
			revert CustomErrors.InvalidOrder();
		}
		uint256 spotPrice = _getUnderlyingPrice(underlyingAsset, strikeAsset);
		// If spot price has deviated too much we want to void the order
		if (order.lowerSpotMovementRange > spotPrice || order.upperSpotMovementRange < spotPrice) {
			revert CustomErrors.SpotMovedBeyondRange();
		}
		// calculate the total premium
		uint256 premium = order.amount.mul(order.price);

		uint256 convertedPrem = OptionsCompute.convertToDecimals(
			premium,
			ERC20(collateralAsset).decimals()
		);
		// transfer the oToken to the liquidityPool
		SafeTransferLib.safeTransferFrom(
			order.seriesAddress,
			msg.sender,
			address(liquidityPool),
			OptionsCompute.convertToDecimals(order.amount, ERC20(order.seriesAddress).decimals())
		);
		// buyback the option contract, includes sending the premium from the pool to the user, option series should be in e8
		liquidityPool.handlerBuybackOption(
			order.optionSeries,
			order.amount,
			getOptionRegistry(),
			order.seriesAddress,
			convertedPrem,
			0, // delta is not used in the liquidityPool unless the oracle implementation is used, so can be set to 0
			msg.sender
		);
		// convert the strike to e18 decimals for storage
		Types.OptionSeries memory seriesToStore = Types.OptionSeries(
			order.optionSeries.expiration,
			uint128(OptionsCompute.convertFromDecimals(order.optionSeries.strike, 8)),
			order.optionSeries.isPut,
			underlyingAsset,
			strikeAsset,
			collateralAsset
		);
		catalogue.updateNetDhvExposureWithOptionSeries(seriesToStore, int256(order.amount));
		getPortfolioValuesFeed().updateStores(
			seriesToStore,
			-int256(order.amount),
			0,
			order.seriesAddress
		);
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

	/**
	 * @notice get the underlying price with just the underlying asset and strike asset
	 * @param underlying   the asset that is used as the reference asset
	 * @param _strikeAsset the asset that the underlying value is denominated in
	 * @return the underlying price
	 */
	function _getUnderlyingPrice(address underlying, address _strikeAsset)
		internal
		view
		returns (uint256)
	{
		return PriceFeed(protocol.priceFeed()).getNormalizedRate(underlying, _strikeAsset);
	}
}
