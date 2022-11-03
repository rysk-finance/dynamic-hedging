// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./Protocol.sol";
import "./PriceFeed.sol";
import "./BeyondPricer.sol";

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

import "@openzeppelin/contracts/security/Pausable.sol";

/**
 *  @title Contract used for all user facing options interactions
 *  @dev Interacts with liquidityPool to write options and quote their prices.
 */
contract BeyondOptionHandler is Pausable, AccessControl, ReentrancyGuard {
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

	mapping(bytes32 => bool) public approvedOptions;
	mapping(bytes32 => bool) public isBuying;
	mapping(bytes32 => bool) public isSelling;
	uint256[] public expirations;
	mapping(uint256 => mapping(bool => uint128[])) public optionDetails;

	/////////////////////////////////////
	/// governance settable variables ///
	/////////////////////////////////////

	// settings for the limits of a custom order
	CustomOrderBounds public customOrderBounds = CustomOrderBounds(0, 25e16, -25e16, 0, 1000);
	// addresses that are whitelisted to sell options back to the protocol
	mapping(address => bool) public buybackWhitelist;
	BeyondPricer public pricer;

	//////////////////////////
	/// constant variables ///
	//////////////////////////

	// BIPS
	uint256 private constant MAX_BPS = 10_000;

	/////////////////////////
	/// structs && events ///
	/////////////////////////

	event SeriesApproved(uint64 expiration, uint128 strike, bool isPut, bool isBuying, bool isSelling);
	event SeriesDisabled(uint64 expiration, uint128 strike, bool isPut);
	event SeriesAltered(uint64 expiration, uint128 strike, bool isPut, bool isBuying, bool isSelling);

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


	constructor(
		address _authority,
		address _protocol,
		address _liquidityPool,
		address _pricer
	) AccessControl(IAuthority(_authority)) {
		protocol = Protocol(_protocol);
		liquidityPool = ILiquidityPool(_liquidityPool);
		pricer = BeyondPricer(_pricer);
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

	function pause() external {
		_onlyGuardian();
		_pause();
	}

	function unpause() external {
		_onlyGuardian();
		_unpause();
	}

	/**
	 * @notice add or remove addresses who have no restrictions on the options they can sell back to the pool
	 */
	function addOrRemoveBuybackAddress(address _addressToWhitelist, bool toAdd) external {
		_onlyGovernor();
		buybackWhitelist[_addressToWhitelist] = toAdd;
	}

	/**
	 * @notice change the pricer 
	 */
	function setPricer(address _pricer) external {
		_onlyGovernor();
		pricer = BeyondPricer(_pricer);
	}


	//////////////////////////////////////////////////////
	/// access-controlled state changing functionality ///
	//////////////////////////////////////////////////////

	/**
	 * @notice issue a series
	 * @param  options option type to mint - strike in e18
	 */
	function issueNewSeries(Types.Option[] memory options)
		external
		nonReentrant
	{
		_onlyManager();
		uint256 addressLength = options.length;
		for (uint i = 0; i < addressLength; i++) {
			Types.Option memory o = options[i];
			bytes32 optionHash = keccak256(abi.encodePacked(o.expiration, o.strike, o.isPut));
			if (approvedOptions[optionHash]) {
				continue;
			} 
			// store information on the series
			approvedOptions[optionHash] = true;
			isBuying[optionHash] = o.isBuying;
			isSelling[optionHash] = o.isSelling;
			// store it in some form of array
			if (optionDetails[o.expiration][true].length == 0 && optionDetails[o.expiration][false].length == 0){
				expirations.push(o.expiration);
			}
			optionDetails[o.expiration][o.isPut].push(o.strike);
			// emit an event of the series creation, now users can write options on this series
			emit SeriesApproved(o.expiration, o.strike, o.isPut, o.isBuying, o.isSelling);
		}

	}

	function disableSeries(Types.Option[] memory options) 
		external
		nonReentrant 
	{
		_onlyManager();
		uint256 adLength = options.length;
		for (uint256 i=0; i < adLength; i++) {
			Types.Option memory o = options[i];
			bytes32 optionHash = keccak256(abi.encodePacked(o.expiration, o.strike, o.isPut));
			approvedOptions[optionHash] = false;
			isBuying[optionHash] = false;
			isSelling[optionHash] = false;
			emit SeriesDisabled(o.expiration, o.strike, o.isPut);
		}
	}

	function changeOptionBuyOrSell(Types.Option[] memory options)
	 external 
	 nonReentrant
	{
		_onlyManager();
		uint256 adLength = options.length;
		for (uint256 i=0; i < adLength; i++) {
			Types.Option memory o = options[i];
			bytes32 optionHash = keccak256(abi.encodePacked(o.expiration, o.strike, o.isPut));
			if (approvedOptions[optionHash]) {
				isBuying[optionHash] = o.isBuying;
				isSelling[optionHash] = o.isSelling;
			} 
			emit SeriesAltered(o.expiration, o.strike, o.isPut, o.isBuying, o.isSelling);
		}

	}

	/////////////////////////////////////////////
	/// external state changing functionality ///
	/////////////////////////////////////////////

	/**
	 * @notice write a number of options for a given series address
	 * @param  seriesAddress the option token series address
	 * @param  amount        the number of options to mint expressed as 1e18
	 * @return number of options minted
	 */
	function writeOption(address seriesAddress, uint256 amount)
		external
		whenNotPaused
		nonReentrant
		returns (uint256)
	{
		IOptionRegistry optionRegistry = getOptionRegistry();
		// get the option series from the pool
		Types.OptionSeries memory optionSeries = optionRegistry.getSeriesInfo(seriesAddress);
		if (optionSeries.expiration == 0) {
			revert CustomErrors.NonExistentOtoken();
		}
		uint128 strikeDecimalConverted = uint128(
			OptionsCompute.convertFromDecimals(optionSeries.strike, ERC20(seriesAddress).decimals())
		);
		// check if the option series is approved
		bytes32 oHash = keccak256(abi.encodePacked(optionSeries.expiration, optionSeries.strike * 1e10, optionSeries.isPut));
		if (!approvedOptions[oHash]) {
			revert CustomErrors.UnapprovedSeries();
		}
		// check if the series is for sale
		if (!isSelling[oHash]) {
			revert CustomErrors.NotSellingSeries();
		}
		// calculate premium and delta
		(uint256 premium, int256 delta) = pricer.quoteOptionPrice(optionSeries, amount, false);
		SafeTransferLib.safeTransferFrom(
			collateralAsset,
			msg.sender,
			address(liquidityPool),
			premium
		);
		// convert the strike to e18 decimals for storage
		Types.OptionSeries memory seriesToStore = Types.OptionSeries(
			optionSeries.expiration,
			strikeDecimalConverted,
			optionSeries.isPut,
			underlyingAsset,
			strikeAsset,
			collateralAsset
		);
		getPortfolioValuesFeed().updateStores(
			seriesToStore,
			int256(amount),
			0,
			seriesAddress
		);
		return
			liquidityPool.handlerWriteOption(
				optionSeries,
				seriesAddress,
				amount,
				optionRegistry,
				premium,
				delta,
				msg.sender
			);
	}

/**
	 * @notice write a number of options for a given series address
	 * @param  optionSeries the option token series address
	 * @param  amount        the number of options to mint expressed as 1e18
	 */
	function issueAndWriteOption(Types.OptionSeries memory optionSeries, uint256 amount)
		external
		whenNotPaused
		nonReentrant
		returns (uint256 optionAmount, address series)
	{
		// check if the option series is approved
		bytes32 oHash = keccak256(abi.encodePacked(optionSeries.expiration, optionSeries.strike, optionSeries.isPut));
		if (!approvedOptions[oHash]) {
			revert CustomErrors.UnapprovedSeries();
		}
		// check if the series is for sale
		if (!isSelling[oHash]) {
			revert CustomErrors.NotSellingSeries();
		}
		// calculate premium
		(uint256 premium, int256 delta) = pricer.quoteOptionPrice(
			optionSeries,
			amount,
			false
		);
		SafeTransferLib.safeTransferFrom(
			collateralAsset,
			msg.sender,
			address(liquidityPool),
			premium
		);
		// write the option, optionAmount in e18
		(optionAmount, series) = liquidityPool.handlerIssueAndWriteOption(
			optionSeries,
			amount,
			premium,
			delta,
			msg.sender
		);
		uint128 strikeDecimalConverted = uint128(
			OptionsCompute.convertFromDecimals(optionSeries.strike, ERC20(series).decimals())
		);
		// convert the strike to e18 decimals for storage
		Types.OptionSeries memory seriesToStore = Types.OptionSeries(
			optionSeries.expiration,
			strikeDecimalConverted,
			optionSeries.isPut,
			underlyingAsset,
			strikeAsset,
			collateralAsset
		);
		getPortfolioValuesFeed().updateStores(
			seriesToStore,
			int256(amount),
			0,
			series
		);
	}

	/**
	 * @notice buys a number of options back and burns the tokens
	 * @param seriesAddress the option token series address to buyback
	 * @param amount the number of options to buyback expressed in 1e18
	 * @return the number of options bought and burned
	 */
	function buybackOption(address seriesAddress, uint256 amount)
		external
		nonReentrant
		whenNotPaused
		returns (uint256)
	{
		IOptionRegistry optionRegistry = getOptionRegistry();
		// get the option series from the pool
		Types.OptionSeries memory optionSeries = optionRegistry.getSeriesInfo(seriesAddress);
		// check if the option series is approved
		bytes32 oHash = keccak256(abi.encodePacked(optionSeries.expiration, optionSeries.strike * 1e10, optionSeries.isPut));
		if (!approvedOptions[oHash]) {
			revert CustomErrors.UnapprovedSeries();
		}
		// check if the series is for buying
		if (!isBuying[oHash]) {
			revert CustomErrors.NotSellingSeries();
		}
		// revert if the expiry is in the past
		if (optionSeries.expiration <= block.timestamp) {
			revert CustomErrors.OptionExpiryInvalid();
		}
		uint128 strikeDecimalConverted = uint128(
			OptionsCompute.convertFromDecimals(optionSeries.strike, ERC20(seriesAddress).decimals())
		);
		// get quote on the option to buy back, always return the total values
		SafeTransferLib.safeTransferFrom(
			seriesAddress,
			msg.sender,
			address(liquidityPool),
			OptionsCompute.convertToDecimals(amount, ERC20(seriesAddress).decimals())
		);
		(uint256 premium, int256 delta) = pricer.quoteOptionPrice(optionSeries, amount, true);
		// convert the strike to e18 decimals for storage
		Types.OptionSeries memory seriesToStore = Types.OptionSeries(
			optionSeries.expiration,
			strikeDecimalConverted,
			optionSeries.isPut,
			underlyingAsset,
			strikeAsset,
			collateralAsset
		);
		getPortfolioValuesFeed().updateStores(
			seriesToStore,
			-int256(amount),
			0,
			seriesAddress
		);
		return
			liquidityPool.handlerBuybackOption(
				optionSeries,
				amount,
				optionRegistry,
				seriesAddress,
				premium,
				delta,
				msg.sender
			);
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
