// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./PriceFeed.sol";
import "./VolatilityFeed.sol";

import "./libraries/Types.sol";
import "./libraries/BlackScholes.sol";
import "./libraries/CustomErrors.sol";
import "./libraries/AccessControl.sol";
import "./libraries/EnumerableSet.sol";

import "./interfaces/ILiquidityPool.sol";
import "./interfaces/IPortfolioValuesFeed.sol";

/**
 * @title AlphaPortfolioValuesFeed contract
 * @notice Options portfolio storage and calculations
 */
contract AlphaPortfolioValuesFeed is AccessControl, IPortfolioValuesFeed {
	using EnumerableSet for EnumerableSet.AddressSet;

	struct OptionStores{
		Types.OptionSeries optionSeries;
		int256 amount;
	}

	///////////////////////////
	/// immutable variables ///
	///////////////////////////

	uint256 public constant rfr = 3e16;

	/////////////////////////
	/// dynamic variables ///
	/////////////////////////

	mapping(address => OptionStores) public storesForAddress;
	// series to loop over stored as issuance hashes
	EnumerableSet.AddressSet internal addressSet;
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
		int256 callPutsValue
	);
	event RequestedUpdate(
		address _underlying, 
		address _strike
	);
	event StoresUpdated(
		Types.OptionSeries optionSeries,
		int256 amount,
		address seriesAddress
	);

	error OptionHasExpiredInStores(uint256 index, address seriesAddress);
	error IncorrectSeriesToRemove();
	error SeriesNotExpired();
	
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

	/**
	 * @notice Fulfills the portfolio delta and portfolio value by doing a for loop over the stores.  This is then used to
	 *         update the portfolio values for external contracts to know what the liquidity pool's value is
	 *		   1/ Make sure any expired options are settled, otherwise this fulfillment will fail
	 *		   2/ Once the addressSet is cleared of any 
	 * @param _underlying - response; underlying address
	 * @param _strikeAsset - response; strike address
	 */
	function fulfill(
		address _underlying,
		address _strikeAsset
	) external {
		int256 delta;
		int256 callPutsValue;
		// get the length of the address set here to save gas on the for loop
		uint lengthAddy = addressSet.length();
		// get the spot price
		uint256 spotPrice = PriceFeed(priceFeed).getNormalizedRate(_underlying, _strikeAsset);
		for (uint i=0; i < lengthAddy; i++) {
			// get series
			OptionStores memory _optionStores = storesForAddress[addressSet.at(i)];
			// check if the series has expired, if it has then flag this, 
			// before retrying, settle all expired options and then clean the looper
			if (_optionStores.optionSeries.expiration < block.timestamp) {revert OptionHasExpiredInStores(i, addressSet.at(i));}
			// get the vol
			uint256 vol = VolatilityFeed(volFeed).getImpliedVolatility(
				_optionStores.optionSeries.isPut, 
				spotPrice, 
				_optionStores.optionSeries.strike, 
				_optionStores.optionSeries.expiration
				);
			// compute the delta and the price
			(uint256 _callPutsValue, int256 _delta)= BlackScholes.blackScholesCalcGreeks(
				spotPrice, 
				_optionStores.optionSeries.strike, 
				_optionStores.optionSeries.expiration, 
				vol,
				rfr, 
				_optionStores.optionSeries.isPut
				);
			// increment the deltas by adding if the option is long and subtracting if the option is short
			delta -= _delta * _optionStores.amount / 1e18 ;
			// increment the values by subtracting if the option is long (as this represents liabilities in the liquidity pool) and adding if the option is short as this value
			// represents liabilities
			callPutsValue += int256(_callPutsValue) * _optionStores.amount / 1e18;
		}
		// update the portfolio values
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
		// reset these values as it is a feature necessary for future upgrades
		liquidityPool.resetEphemeralValues();
		emit DataFullfilled(_underlying, _strikeAsset, delta, 0, 0, 0, callPutsValue);
	}

	//////////////////////////////////////////////////////
	/// access-controlled state changing functionality ///
	//////////////////////////////////////////////////////

	/**
	 * @notice Updates the option series stores to be used for portfolio value calculation
	 * @param _optionSeries the option series that was created, strike in e18
	 * @param _amount the number of options being minted in e18
	 * @param _isLong whether the option being stored is a long or short position
	 * @param _seriesAddress the address of the series represented by the oToken
	 * @dev   callable by the handler and also during migration
	 */
	function updateStores(
		Types.OptionSeries memory _optionSeries,
		uint256 _amount,
		bool _isLong,
		address _seriesAddress
	) external {
		_isHandler();
		int256 signedAmount = _isLong ? -int256(_amount) : int256(_amount);
		if (!addressSet.contains(_seriesAddress)) {
			// maybe store them by expiry instead
			addressSet.add(_seriesAddress);
			storesForAddress[_seriesAddress] = OptionStores(_optionSeries, signedAmount);
		} else {
			storesForAddress[_seriesAddress].amount += signedAmount;
		}
		emit StoresUpdated(_optionSeries, signedAmount, _seriesAddress);
	}

	////////////////////////////////////////////////////////////////////////////////////////////
	/**  LOOP CLEANING - FOR ALPHA
	  *   This is necessary to reduce the size of the foor loop when its not necessary to.
      *   - Make sure the option has been settled!
	  */ 
	////////////////////////////////////////////////////////////////////////////////////////////
	address[] private addyList;
	/**
	  * @notice function to clean all expired series from the options storage to remove them from the looped array.
	  * @dev 	FOLLOW THE LOOP CLEANING INSTRUCTIONS ABOVE WHEN CALLING THIS FUNCTION
	  */
	function syncLooper() external {
		_isKeeper();
		uint lengthAddy = addressSet.length();
		for (uint i; i < lengthAddy; i++) {
			if(storesForAddress[addressSet.at(i)].optionSeries.expiration < block.timestamp) {
				addyList.push(addressSet.at(i));
			}
		}
		lengthAddy = addyList.length;
		for  (uint j; j < lengthAddy; j++) {
			_cleanLooper(addyList[j]);
		}
		delete addyList;
	}

	/**
	  * @notice function to clean an expired series from the portfolio values feed, this function will make sure the series and index match
	  *			and will also check if the series has expired before any cleaning happens.
	  * @param  index the index of the option series to clear
	  * @param  _series the series at the index input above
	  * @dev 	FOLLOW THE LOOP CLEANING INSTRUCTIONS ABOVE WHEN CALLING THIS FUNCTION
	  */
	function cleanLooperManually(uint256 index, address _series) public {
		_isKeeper();
		address series = addressSet.at(index);
		if (series != _series) {revert IncorrectSeriesToRemove();}
		if (storesForAddress[_series].optionSeries.expiration > block.timestamp) {revert SeriesNotExpired();}
		_cleanLooper(_series);
	}

	/**
	  * @notice internal function for removing an address from the address set and clearing all option stores for that series
	  * @param  _series the option series address to be cleared
	  */
	function _cleanLooper(address _series) internal {
		// clean out the address
		addressSet.remove(_series);
		// delete the stores
		delete storesForAddress[_series];
	}

	////////////////////////////////////////////////////////////////////////////////////////////
	/**  MIGRATION PROCESS - FOR ALPHA
	  *	  1/ On the migrate contract set this contract as a handler via Governance
	  *   2/ Make sure the storage of options in this contract is up to date and clean/synced
	  *   3/ Call migrate here via Governance 
	  *   3i/ If the migration gas gets too big then
	  *   4/ Make sure the storage was correctly transferred to the new contract
	  *   5/ Properly configure the handlers on the new contract via Governance
	  *   6/ Properly configure the keepers on the new contract via Governance
	  *   7/ Set the liquidity pool on the new contract via Governance
	  *   8/ Change the PortfolioValuesFeed in the Protocol contract via Governance
      */ 
	////////////////////////////////////////////////////////////////////////////////////////////

	/**
	  * @notice migrate all stored options data to a new contract that has the IPortfolioValuesFeed interface
	  * @param  _migrateContract the new portfolio values feed contract to migrate option values too
	  * @dev 	FOLLOW THE MIGRATION PROCESS INSTRUCTIONS WHEN CALLING THIS FUNCTION
	  */
	function migrate(IPortfolioValuesFeed _migrateContract) external {
		_onlyGovernor();
		uint lengthAddy = addressSet.length();
		for (uint i=0; i < lengthAddy; i++) {
			address oTokenAddy = addressSet.at(i);
			OptionStores memory _optionStores = storesForAddress[oTokenAddy];
			uint256 unsignedAmount = _optionStores.amount > 0 ? uint256(_optionStores.amount) : uint256(-_optionStores.amount);
			_migrateContract.updateStores(
				_optionStores.optionSeries, 
				unsignedAmount, 
				_optionStores.amount < 0, 
				oTokenAddy
				);
		}
	} 

	/////////////////////////////////////////////
	/// external state changing functionality ///
	/////////////////////////////////////////////

	/**
	 * @notice requests a portfolio data update
	 *
	 */
	function requestPortfolioData(address _underlying, address _strike)
		external
		returns (bytes32 id)
	{
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
	/// @dev handlers can access
	function _isHandler() internal view {
		if (
			!handler[msg.sender]
		) {
			revert();
		}
	}
	/// get the address set details
	function isAddressInSet(address _a) external view returns (bool) {
		return addressSet.contains(_a);
	}
	function addressAtIndexInSet(uint256 _i) external view returns (address) {
		return addressSet.at(_i);
	}
	function addressSetLength() external view returns (uint256) {
		return addressSet.length();
	}
	function getAddressSet() external view returns (address[] memory) {
		return addressSet.values();
	}
}
