// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./PriceFeed.sol";
import "./VolatilityFeed.sol";

import "./libraries/Types.sol";
import "./libraries/BlackScholes.sol";
import "./libraries/CustomErrors.sol";
import "./libraries/AccessControl.sol";

import "./interfaces/ILiquidityPool.sol";


// TODO:
// - deal with ITM expired options
// - get the opyn expired price and figure out how to check if a vault was settled
// - good way to get rfr
// - add the ability to reduce the size of option positions (for buybacks)

/**
 * @title The PortfolioValuesFeed contract
 * @notice An external adapter Consumer contract that makes requests to obtain portfolio values for different pools
 */
contract AlphaPortfolioValuesFeedComplicated is AccessControl {

	///////////////////////////
	/// immutable variables ///
	///////////////////////////

	/////////////////////////
	/// dynamic variables ///
	/////////////////////////

	struct OptionStores{
		Types.OptionSeries optionSeries;
		uint256 amount;
	}
	struct ExpiryStorage{
		mapping(address => OptionStores) stores; 
		address[] addressList;
	}

	mapping(uint64 => ExpiryStorage) internal storesForExpiry;
	// series to loop over stored as issuance hashes
	uint64[] public expiriesToLoop;
	// portfolio values
	mapping(address => mapping(address => Types.PortfolioValues)) private portfolioValues;

	/////////////////////////////////
	/// govern settable variables ///
	/////////////////////////////////

	address public priceFeed;
	address public volFeed;
	ILiquidityPool public liquidityPool;
	// handlers that can push to this contract
	mapping(address => bool) public handler;
	// keeper mapping
	mapping(address => bool) public keeper;

	//////////////
	/// events ///
	//////////////

	event DataFullfilled(
		address indexed underlying,
		address indexed strike,
		int256 delta,
		int256 gamma,
		int256 vega,
		int256 theta,
		uint256 callPutsValue
	);
	event RequestedUpdate(
		address _underlying, 
		address _strike
	);
	event StoresUpdated(
		Types.OptionSeries optionSeries,
		uint256 amount,
		address seriesAddress
	);

	/**
	 * @notice Executes once when a contract is created to initialize state variables
	 *
	 */
	constructor(
		address _authority,
		address _priceFeed,
		address _volFeed
	) AccessControl(IAuthority(_authority)) {
		priceFeed = _priceFeed;
		volFeed = _volFeed;
	}

	///////////////
	/// setters ///
	///////////////

	function setLiquidityPool(address _liquidityPool) external {
		_onlyGovernor();
		liquidityPool = ILiquidityPool(_liquidityPool);
	}

	function setPriceFeed(address _priceFeed) external {
		_onlyGovernor();
		priceFeed = _priceFeed;
	}

	/**
	 * @notice change the status of a keeper
	 */
	function setKeeper(address _keeper, bool _auth) external {
		_onlyGovernor();
		keeper[_keeper] = _auth;
	}

	/**
	 * @notice change the status of a handler
	 */
	function setHandler(address _handler, bool _auth) external {
		_onlyGovernor();
		handler[_handler] = _auth;
	}

	//////////////////////////////////////////////////////
	/// access-controlled state changing functionality ///
	//////////////////////////////////////////////////////

	/**
	 * @notice Receives the response
	 *
	 * @param _underlying - response; underlying address
	 * @param _strikeAsset - response; strike address
	 */
	function fulfill(
		address _underlying,
		address _strikeAsset
	) external {
		int256 delta;
		int256 _delta;
		uint256 _callPutsValue;
		uint256 callPutsValue;
		uint lengthExpiry = expiriesToLoop.length;
		// get the spot price
		uint256 spotPrice = PriceFeed(priceFeed).getNormalizedRate(_underlying, _strikeAsset);
		uint256 rfr = 0;
		for (uint i=0; i < lengthExpiry; i++) {
			ExpiryStorage storage expiryStorage = storesForExpiry[expiriesToLoop[i]];
			uint256 lengthSeries = expiryStorage.addressList.length;
			for (uint j=0; j < lengthSeries; j++) {
				// get series
				OptionStores memory _optionStores = expiryStorage.stores[expiryStorage.addressList[i]];
				// get the vol
				uint256 vol = VolatilityFeed(volFeed).getImpliedVolatility(
					_optionStores.optionSeries.isPut, 
					spotPrice, 
					_optionStores.optionSeries.strike, 
					_optionStores.optionSeries.expiration
					);
				// compute the delta and the price
				(_callPutsValue, _delta)= BlackScholes.blackScholesCalcGreeks(
					spotPrice, 
					_optionStores.optionSeries.strike, 
					_optionStores.optionSeries.expiration, 
					vol,
					rfr, 
					_optionStores.optionSeries.isPut
					);
				// increment the deltas and value
				delta -= _delta * int256(_optionStores.amount) / 1e18;
				callPutsValue += _callPutsValue * _optionStores.amount / 1e18;
			}

		}
		Types.PortfolioValues memory portfolioValue = Types.PortfolioValues({
			delta: delta,
			gamma: 0,
			vega: 0,
			theta: 0,
			callPutsValue: callPutsValue,
			spotPrice: spotPrice,
			timestamp: block.timestamp
		});
		portfolioValues[_underlying][_strikeAsset] = portfolioValue;
		liquidityPool.resetEphemeralValues();
		emit DataFullfilled(_underlying, _strikeAsset, delta, 0, 0, 0, _callPutsValue);
	}

	/**
	 * @notice Updates the option series stores
	 *
	 * @param _optionSeries series
	 * @param _amount total
	 */
	function updateStores(
		Types.OptionSeries memory _optionSeries,
		uint256 _amount,
		address _seriesAddress
	) external {
		_isHandler();
		OptionStores memory stores_ = storesForExpiry[_optionSeries.expiration].stores[_seriesAddress];
		if (stores_.optionSeries.expiration == 0) {
			// maybe store them by expiry instead
			expiriesToLoop.push(_optionSeries.expiration);
			storesForExpiry[_optionSeries.expiration].addressList.push(_seriesAddress);
			storesForExpiry[_optionSeries.expiration].stores[_seriesAddress] = OptionStores(_optionSeries, _amount);
		} else {
			storesForExpiry[_optionSeries.expiration].stores[_seriesAddress].amount += _amount;
		}

		emit StoresUpdated(_optionSeries, _amount, _seriesAddress);
	}

	/////////////////////////////////////////////
	/// external state changing functionality ///
	/////////////////////////////////////////////

	/**
	 * @notice requests stuff
	 *
	 */
	function requestPortfolioData(address _underlying, address _strike)
		external
	{
		_isKeeper();
		emit RequestedUpdate(_underlying, _strike);
	}

	///////////////////////////
	/// non-complex getters ///
	///////////////////////////

	function getPortfolioValues(address underlying, address strike)
		external
		view
		returns (Types.PortfolioValues memory)
	{
		return portfolioValues[underlying][strike];
	}


	/// @dev keepers, managers or governors can access
	function _isKeeper() internal view {
		if (
			!keeper[msg.sender] && msg.sender != authority.governor() && msg.sender != authority.manager()
		) {
			revert CustomErrors.NotKeeper();
		}
	}
		/// @dev keepers, managers or governors can access
	function _isHandler() internal view {
		if (
			!handler[msg.sender]
		) {
			revert();
		}
	}
}
