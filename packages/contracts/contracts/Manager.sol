// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.0;

import "prb-math/contracts/PRBMathSD59x18.sol";
import "./interfaces/IAlphaOptionHandler.sol";
import "./LiquidityPool.sol";
import "./OptionExchange.sol";
import "./OptionCatalogue.sol";
import "./BeyondPricer.sol";

import "./libraries/AccessControl.sol";
import "./libraries/CustomErrors.sol";

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

	function setSlippageGradient(uint256 _slippageGradient) external {
		_isProxyManager();
		beyondPricer.setSlippageGradient(_slippageGradient);
	}

	function setCollateralLendingRate(uint256 _collateralLendingRate) external {
		_isProxyManager();
		beyondPricer.setCollateralLendingRate(_collateralLendingRate);
	}

	function setDeltaBorrowRates(BeyondPricer.DeltaBorrowRates calldata _deltaBorrowRates) external {
		_isProxyManager();
		beyondPricer.setDeltaBorrowRates(_deltaBorrowRates);
	}

	/// @dev must also update delta band arrays to fit the new delta band width
	function setDeltaBandWidth(
		uint256 _deltaBandWidth,
		uint256[] memory _callSlippageGradientMultipliers,
		uint256[] memory _putSlippageGradientMultipliers
	) external {
		_isProxyManager();
		beyondPricer.setDeltaBandWidth(
			_deltaBandWidth,
			_callSlippageGradientMultipliers,
			_putSlippageGradientMultipliers
		);
	}

	function setSlippageGradientMultipliers(
		uint256[] memory _callSlippageGradientMultipliers,
		uint256[] memory _putSlippageGradientMultipliers
	) public {
		_isProxyManager();
		beyondPricer.setSlippageGradientMultipliers(
			_callSlippageGradientMultipliers,
			_putSlippageGradientMultipliers
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
}
