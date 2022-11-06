// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./PriceFeed.sol";
import "./VolatilityFeed.sol";

import "./libraries/Types.sol";
import "./libraries/BlackScholes.sol";
import "./libraries/CustomErrors.sol";
import "./libraries/AccessControl.sol";
import "./libraries/EnumerableSet.sol";
import "./libraries/OptionsCompute.sol";

import "./Protocol.sol";
import "./interfaces/GammaInterface.sol";
import "./interfaces/ILiquidityPool.sol";
import "./interfaces/IOptionRegistry.sol";
import "./interfaces/IPortfolioValuesFeed.sol";

import "hardhat/console.sol";
/**
 * @title AlphaPortfolioValuesFeed contract
 * @notice Options portfolio storage and calculations
 */
contract AlphaPortfolioValuesFeed is AccessControl, IPortfolioValuesFeed {
	using EnumerableSet for EnumerableSet.AddressSet;

	struct OptionStores {
		Types.OptionSeries optionSeries;
		int256 shortExposure;
		int256 longExposure;
	}

	///////////////////////////
	/// immutable variables ///
	///////////////////////////

	uint256 constant oTokenDecimals = 8;

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

	Protocol public protocol;
	ILiquidityPool public liquidityPool;
	// handlers that can push to this contract
	mapping(address => bool) public handler;
	// keeper mapping
	mapping(address => bool) public keeper;
	// risk free rate
	uint256 public rfr = 0;

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
	event RequestedUpdate(address _underlying, address _strike);
	event StoresUpdated(
		address seriesAddress,
		int256 shortExposure,
		int256 longExposure,
		Types.OptionSeries optionSeries
	);

	error OptionHasExpiredInStores(uint256 index, address seriesAddress);
	error NoVaultForShortPositions();
	error IncorrectSeriesToRemove();
	error SeriesNotExpired();
	error NoShortPositions();

	/**
	 * @notice Executes once when a contract is created to initialize state variables
	 *		   Make sure the protocol is configured after deployment
	 */
	constructor(address _authority) AccessControl(IAuthority(_authority)) {}

	///////////////
	/// setters ///
	///////////////

	function setLiquidityPool(address _liquidityPool) external {
		_onlyGovernor();
		liquidityPool = ILiquidityPool(_liquidityPool);
	}

	function setProtocol(address _protocol) external {
		_onlyGovernor();
		protocol = Protocol(_protocol);
	}

	function setRFR(uint256 _rfr) external {
		_onlyGovernor();
		rfr = _rfr;
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
	function fulfill(address _underlying, address _strikeAsset) external {
		int256 delta;
		int256 callPutsValue;
		// get the length of the address set here to save gas on the for loop
		uint256 lengthAddy = addressSet.length();
		// get the spot price
		uint256 spotPrice = _getUnderlyingPrice(_underlying, _strikeAsset);
		VolatilityFeed volFeed = _getVolatilityFeed();
		for (uint256 i = 0; i < lengthAddy; i++) {
			// get series
			OptionStores memory _optionStores = storesForAddress[addressSet.at(i)];
			// check if the series has expired, if it has then flag this,
			// before retrying, settle all expired options and then clean the looper
			if (_optionStores.optionSeries.expiration < block.timestamp) {
				revert OptionHasExpiredInStores(i, addressSet.at(i));
			}
			// get the vol
			uint256 vol = volFeed.getImpliedVolatility(
				_optionStores.optionSeries.isPut,
				spotPrice,
				_optionStores.optionSeries.strike,
				_optionStores.optionSeries.expiration
			);
			// compute the delta and the price
			(uint256 _callPutsValue, int256 _delta) = BlackScholes.blackScholesCalcGreeks(
				spotPrice,
				_optionStores.optionSeries.strike,
				_optionStores.optionSeries.expiration,
				vol,
				rfr,
				_optionStores.optionSeries.isPut
			);
			// calculate the net exposure
			int256 netExposure = _optionStores.shortExposure - _optionStores.longExposure;
			// increment the deltas by adding if the option is long and subtracting if the option is short
			delta -= (_delta * netExposure) / 1e18;
			// increment the values by subtracting if the option is long (as this represents liabilities in the liquidity pool) and adding if the option is short as this value
			// represents liabilities
			callPutsValue += (int256(_callPutsValue) * netExposure) / 1e18;
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
	 * @param shortExposure the amount of short to increment the short exposure by
	 * @param longExposure the amount of long to increment the long exposure by
	 * @param _seriesAddress the address of the series represented by the oToken
	 * @dev   callable by the handler and also during migration
	 */
	function updateStores(
		Types.OptionSeries memory _optionSeries,
		int256 shortExposure,
		int256 longExposure,
		address _seriesAddress
	) external {
		_isHandler();
		if (!addressSet.contains(_seriesAddress)) {
			// maybe store them by expiry instead
			addressSet.add(_seriesAddress);
			storesForAddress[_seriesAddress] = OptionStores(_optionSeries, shortExposure, longExposure);
		} else {
			storesForAddress[_seriesAddress].shortExposure += shortExposure;
			storesForAddress[_seriesAddress].longExposure += longExposure;
		}
		emit StoresUpdated(_seriesAddress, shortExposure, longExposure, _optionSeries);
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
		uint256 lengthAddy = addressSet.length();
		for (uint256 i; i < lengthAddy; i++) {
			if (storesForAddress[addressSet.at(i)].optionSeries.expiration < block.timestamp) {
				addyList.push(addressSet.at(i));
			}
		}
		lengthAddy = addyList.length;
		for (uint256 j; j < lengthAddy; j++) {
			_cleanLooper(addyList[j]);
		}
		delete addyList;
	}

	/**
	 * @notice function to clean an expired series from the portfolio values feed, this function will make sure the series and index match
	 *			and will also check if the series has expired before any cleaning happens.
	 * @param  _series the series at the index input above
	 * @dev 	FOLLOW THE LOOP CLEANING INSTRUCTIONS ABOVE WHEN CALLING THIS FUNCTION
	 */
	function cleanLooperManually(address _series) external {
		_isKeeper();
		if (!addressSet.contains(_series)) {
			revert IncorrectSeriesToRemove();
		}
		if (storesForAddress[_series].optionSeries.expiration > block.timestamp) {
			revert SeriesNotExpired();
		}
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

	/**
	 * @notice if a vault has been liquidated we need to account for it, so adjust our short positions to reality
	 * @param  _series the option series address to be cleared
	 */
	function accountLiquidatedSeries(address _series) external {
		_isKeeper();
		if (!addressSet.contains(_series)) {
			revert IncorrectSeriesToRemove();
		}
		// get the series
		OptionStores memory _optionStores = storesForAddress[_series];
		// check if there are any short positions for this asset
		if (_optionStores.shortExposure == 0) {
			revert NoShortPositions();
		}
		// get the vault for this option series from the option registry
		IOptionRegistry optionRegistry = _getOptionRegistry();
		uint256 vaultId = optionRegistry.vaultIds(_series);
		// check if a vault id exists for that series
		if (vaultId == 0) {
			revert NoVaultForShortPositions();
		}
		// get the vault details and reset the short exposure to whatever it is
		uint256 shortAmounts = OptionsCompute.convertFromDecimals(
			IController(optionRegistry.gammaController())
				.getVault(address(optionRegistry), vaultId)
				.shortAmounts[0],
			oTokenDecimals
		);
		storesForAddress[_series].shortExposure = int256(shortAmounts);
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
		uint256 lengthAddy = addressSet.length();
		for (uint256 i = 0; i < lengthAddy; i++) {
			address oTokenAddy = addressSet.at(i);
			OptionStores memory _optionStores = storesForAddress[oTokenAddy];
			_migrateContract.updateStores(
				_optionStores.optionSeries,
				_optionStores.shortExposure,
				_optionStores.longExposure,
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
	function requestPortfolioData(address _underlying, address _strike) external returns (bytes32 id) {
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
		if (!handler[msg.sender]) {
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

	/**
	 * @notice get the volatility feed used by the liquidity pool
	 * @return the volatility feed contract interface
	 */
	function _getVolatilityFeed() internal view returns (VolatilityFeed) {
		return VolatilityFeed(protocol.volatilityFeed());
	}

	/**
	 * @notice get the option registry used for storing and managing the options
	 * @return the option registry contract
	 */
	function _getOptionRegistry() internal view returns (IOptionRegistry) {
		return IOptionRegistry(protocol.optionRegistry());
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
