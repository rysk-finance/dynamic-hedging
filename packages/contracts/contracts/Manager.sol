// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.0;

import "prb-math/contracts/PRBMathSD59x18.sol";
import "./interfaces/IAlphaOptionHandler.sol";
import "./LiquidityPool.sol";
import "./OptionExchange.sol";
import "./OptionCatalogue.sol";
import "./BeyondPricer.sol";
import { IRangeOrderReactor, Position, IUniswapV3PoolState } from "./interfaces/IRangeOrderReactor.sol";

import "./libraries/AccessControl.sol";
import "./libraries/CustomErrors.sol";

struct RebalanceCaller {
	address caller;
	uint256 deltaUsed;
}

/**
 *  @title Contract used for all user facing options interactions
 */
contract Manager is AccessControl {
	using PRBMathSD59x18 for int256;
	/////////////////////////////////////
	/// governance settable variables ///
	/////////////////////////////////////

	// delta limit for an address
	mapping(address => uint256) public deltaLimit;
	// reactor index to last caller and delta allowance deducted
	mapping(uint256 => RebalanceCaller) public rebalanceCallers;
	// option handler
	IAlphaOptionHandler public optionHandler;
	// liquidity pool
	LiquidityPool public liquidityPool;
	// option catalogue
	OptionCatalogue public optionCatalogue;
	// option exchange
	OptionExchange public optionExchange;
	// beyond pricer
	BeyondPricer public beyondPricer;

	// keeper mapping
	mapping(address => bool) public keeper;
	// proxy manager
	address public proxyManager;

	error ExceedsDeltaLimit();
	error NotProxyManager();

	constructor(
		address _authority,
		address _liquidityPool,
		address _optionHandler,
		address _optionCatalogue,
		address _optionExchange,
		address _beyondPricer
	) AccessControl(IAuthority(_authority)) {
		liquidityPool = LiquidityPool(_liquidityPool);
		optionHandler = IAlphaOptionHandler(_optionHandler);
		optionCatalogue = OptionCatalogue(_optionCatalogue);
		optionExchange = OptionExchange(_optionExchange);
		beyondPricer = BeyondPricer(_beyondPricer);
	}

	///////////////
	/// setters ///
	///////////////

	/**
	 * @notice change the status of a keeper
	 */
	function setKeeper(address _keeper, bool _auth) external {
		_onlyGovernor();
		if (_keeper == address(0)) {
			revert CustomErrors.InvalidAddress();
		}
		keeper[_keeper] = _auth;
	}

	/**
	 * @notice change the status of a proxy manager
	 */
	function setProxyManager(address _proxyManager) external {
		_onlyGovernor();
		if (_proxyManager == address(0)) {
			revert CustomErrors.InvalidAddress();
		}
		proxyManager = _proxyManager;
	}

	/**
	 * @notice set the delta limit on a keeper
	 */
	function setDeltaLimit(uint256[] calldata _delta, address[] calldata _keeper) external {
		_isProxyManager();
		for (uint256 i = 0; i < _delta.length; i++) {
			deltaLimit[_keeper[i]] = _delta[i];
		}
	}

	//////////////
	/// Config ///
	//////////////

	function pullManager() external {
		_onlyGovernor();
		authority.pullManager();
	}

	//////////////////////
	/// Option Handler ///
	//////////////////////

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
		address _buyerAddress,
		bool _isBuyBack,
		uint256[2] memory _spotMovementRange
	) public returns (uint256) {
		_isProxyManager();
		optionHandler.createOrder(
			_optionSeries,
			_amount,
			_price,
			_orderExpiry,
			_buyerAddress,
			_isBuyBack,
			_spotMovementRange
		);
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
		address _buyerAddress,
		uint256[2] memory _callSpotMovementRange,
		uint256[2] memory _putSpotMovementRange
	) external returns (uint256, uint256) {
		_isProxyManager();
		optionHandler.createStrangle(
			_optionSeriesCall,
			_optionSeriesPut,
			_amountCall,
			_amountPut,
			_priceCall,
			_pricePut,
			_orderExpiry,
			_buyerAddress,
			_callSpotMovementRange,
			_putSpotMovementRange
		);
	}

	//////////////////////
	/// Liquidity Pool ///
	//////////////////////

	/**
	 * @notice function for hedging portfolio delta through external means
	 * @param delta the current portfolio delta
	 * @param reactorIndex the index of the reactor in the hedgingReactors array to use
	 */
	function rebalancePortfolioDelta(int256 delta, uint256 reactorIndex) external {
		_isKeeper();
		uint256 absoluteDelta = uint256(PRBMathSD59x18.abs(delta));
		if (absoluteDelta > deltaLimit[msg.sender]) {
			revert ExceedsDeltaLimit();
		}
		deltaLimit[msg.sender] -= absoluteDelta;
		rebalanceCallers[reactorIndex] = RebalanceCaller(msg.sender, absoluteDelta);
		liquidityPool.rebalancePortfolioDelta(delta, reactorIndex);
	}

	/**
	 * @notice update all optionParam variables for max and min strikes and max and
	 *         min expiries for options that the DHV can issue
	 */
	function setNewOptionParams(
		uint128 _newMinCallStrike,
		uint128 _newMaxCallStrike,
		uint128 _newMinPutStrike,
		uint128 _newMaxPutStrike,
		uint128 _newMinExpiry,
		uint128 _newMaxExpiry
	) external {
		_isProxyManager();
		liquidityPool.setNewOptionParams(
			_newMinCallStrike,
			_newMaxCallStrike,
			_newMinPutStrike,
			_newMaxPutStrike,
			_newMinExpiry,
			_newMaxExpiry
		);
	}

	///////////////////////
	/// Option Exchange ///
	///////////////////////

	/**
	 * @notice get the dhv to redeem an expired otoken
	 * @param _series the list of series to redeem
	 */
	function redeem(address[] memory _series, uint256[] memory amountOutMinimums) external {
		_isProxyManager();
		optionExchange.redeem(_series, amountOutMinimums);
	}

	////////////////////////
	/// Option Catalogue ///
	////////////////////////

	/**
	 * @notice issue an option series for buying or sale
	 * @param  options option type to approve - strike in e18
	 * @dev    only callable by the manager
	 */
	function issueNewSeries(Types.Option[] memory options) external {
		_isProxyManager();
		optionCatalogue.issueNewSeries(options);
	}

	/**
	 * @notice change whether an issued option is for buy or sale
	 * @param  options option type to change status on - strike in e18
	 * @dev    only callable by the manager
	 */
	function changeOptionBuyOrSell(Types.Option[] memory options) external {
		_isKeeper();
		optionCatalogue.changeOptionBuyOrSell(options);
	}

	/////////////////////
	/// Beyond Pricer ///
	/////////////////////

	function setLowDeltaSellOptionFlatIV(uint256 _lowDeltaSellOptionFlatIV) external {
		_isKeeper();
		beyondPricer.setLowDeltaSellOptionFlatIV(_lowDeltaSellOptionFlatIV);
	}

	function setLowDeltaThreshold(uint256 _lowDeltaThreshold) external {
		_isKeeper();
		beyondPricer.setLowDeltaThreshold(_lowDeltaThreshold);
	}

	function setRiskFreeRate(uint256 _riskFreeRate) external {
		_isProxyManager();
		beyondPricer.setRiskFreeRate(_riskFreeRate);
	}

	function setBidAskIVSpread(uint256 _bidAskIVSpread) external {
		_isKeeper();
		beyondPricer.setBidAskIVSpread(_bidAskIVSpread);
	}

	function setSlippageGradient(uint256 _slippageGradient) external {
		_isKeeper();
		beyondPricer.setSlippageGradient(_slippageGradient);
	}

	function setCollateralLendingRate(uint256 _collateralLendingRate) external {
		_isKeeper();
		beyondPricer.setCollateralLendingRate(_collateralLendingRate);
	}

	function setDeltaBorrowRates(BeyondPricer.DeltaBorrowRates calldata _deltaBorrowRates) external {
		_isKeeper();
		beyondPricer.setDeltaBorrowRates(_deltaBorrowRates);
	}

	function initializeTenorParams(
		uint256 _deltaBandWidth,
		uint16 _numberOfTenors,
		uint16 _maxTenorValue,
		BeyondPricer.DeltaBandMultipliers[] memory _tenorPricingParams
	) external {
		_isProxyManager();
		beyondPricer.initializeTenorParams(
			_deltaBandWidth,
			_numberOfTenors,
			_maxTenorValue,
			_tenorPricingParams
		);
	}

	function setSlippageGradientMultipliers(
		uint16 _tenorIndex,
		int80[] memory _callSlippageGradientMultipliers,
		int80[] memory _putSlippageGradientMultipliers
	) public {
		_isKeeper();
		beyondPricer.setSlippageGradientMultipliers(
			_tenorIndex,
			_callSlippageGradientMultipliers,
			_putSlippageGradientMultipliers
		);
	}

	function setSpreadCollateralMultipliers(
		uint16 _tenorIndex,
		int80[] memory _callSpreadCollateralMultipliers,
		int80[] memory _putSpreadCollateralMultipliers
	) public {
		_isKeeper();
		beyondPricer.setSpreadCollateralMultipliers(
			_tenorIndex,
			_callSpreadCollateralMultipliers,
			_putSpreadCollateralMultipliers
		);
	}

	function setSpreadDeltaMultipliers(
		uint16 _tenorIndex,
		int80[] memory _callSpreadDeltaMultipliers,
		int80[] memory _putSpreadDeltaMultipliers
	) public {
		_isKeeper();
		beyondPricer.setSpreadDeltaMultipliers(
			_tenorIndex,
			_callSpreadDeltaMultipliers,
			_putSpreadDeltaMultipliers
		);
	}

	/// @dev keepers, managers or governors can access
	function _isKeeper() internal view {
		if (!keeper[msg.sender] && msg.sender != authority.governor()) {
			revert CustomErrors.NotKeeper();
		}
	}

	/// @dev proxy managers, managers or governors can access
	function _isProxyManager() internal view {
		if (msg.sender != proxyManager && msg.sender != authority.governor()) {
			revert NotProxyManager();
		}
	}

	///////////////////////////
	/// Range Order Reactor ///
	///////////////////////////

	/**
	 * @notice Exits an active range order
	 * @param reactorIndex the index of the range order reactor
	 */
	function exitActiveRangeOrder(uint256 reactorIndex) external {
		_isKeeper();
		address rangeOrderReactorAddress = liquidityPool.hedgingReactors(reactorIndex);
		IRangeOrderReactor rangeOrderReactor = IRangeOrderReactor(rangeOrderReactorAddress);
		_handleReclaimDelta(reactorIndex, rangeOrderReactor);
		rangeOrderReactor.exitActiveRangeOrder();
	}

	function _handleReclaimDelta(uint256 reactorIndex, IRangeOrderReactor rangeOrderReactor) internal {
		RebalanceCaller memory rebalanceCaller = rebalanceCallers[reactorIndex];
		if (rebalanceCaller.deltaUsed > 0) {
			IUniswapV3PoolState uniswapPool = rangeOrderReactor.pool();
			(, int24 tick) = uniswapPool.slot0();
			Position memory currentOrder = rangeOrderReactor.currentPosition();
			deltaLimit[rebalanceCaller.caller] += reclaimableDelta(
				rebalanceCaller.deltaUsed,
				tick,
				currentOrder
			);
			delete rebalanceCallers[reactorIndex];
		}
	}

	/**
	 * @notice Calculates amount of delta that can be reclaimed depending on how much of the range order was filled
	 * @param deltaAmount the amount of delta used to execute the range order
	 * @param tick the current tick of the pool
	 * @param currentOrder the current position of the range order reactor
	 */
	function reclaimableDelta(
		uint256 deltaAmount,
		int24 tick,
		Position memory currentOrder
	) public pure returns (uint256) {
		uint256 filled = percentageFilled(tick, currentOrder);
		// Calculate reclaimable amount
		uint256 reclaimable = (deltaAmount * (1e18 - filled)) / 1e18;
		return reclaimable;
	}

	/**
	 * @notice Calculates the percentage of the range order that has been filled
	 * @param tick the current tick of the pool
	 * @param position the current position of the range order reactor
	 */
	function percentageFilled(int24 tick, Position memory position) public pure returns (uint256) {
		int256 totalRange = int256(position.activeUpperTick - position.activeLowerTick);

		if (totalRange == 0) return 0;

		int256 distance;
		if (position.activeRangeAboveTick) {
			distance = tick < position.activeLowerTick ? int256(0) : int256(position.activeUpperTick - tick);
		} else {
			distance = tick > position.activeUpperTick ? int256(0) : int256(tick - position.activeLowerTick);
		}

		// Clamp the distance to be within the range [0, totalRange]
		if (distance < 0) distance = 0;
		if (distance > totalRange) distance = totalRange;

		return uint256((distance * 1e18) / totalRange);
	}
}
