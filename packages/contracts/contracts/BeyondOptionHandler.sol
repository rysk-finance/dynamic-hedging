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

import "hardhat/console.sol";

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

	// Liquidity pool contract
	ILiquidityPool public immutable liquidityPool;
	// protocol management contract
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

	// option configurations approved for sale, stored by hash of expiration timestamp, strike (in e18) and isPut bool
	mapping(bytes32 => bool) public approvedOptions;
	// whether the dhv is buying this option stored by hash
	mapping(bytes32 => bool) public isBuying;
	// whether the dhv is selling this option stored by hash
	mapping(bytes32 => bool) public isSelling;
	// array of expirations currently supported (mainly for frontend use)
	uint64[] public expirations;
	// details of supported options first key is expiration then isPut then an array of strikes (mainly for frontend use)
	mapping(uint256 => mapping(bool => uint128[])) public optionDetails;

	/////////////////////////////////////
	/// governance settable variables ///
	/////////////////////////////////////

	// settings for the limits of a custom order
	CustomOrderBounds public customOrderBounds = CustomOrderBounds(0, 25e16, -25e16, 0, 1000);
	// addresses that are whitelisted to sell options back to the protocol
	mapping(address => bool) public buybackWhitelist;
	// pricer contract used for pricing options
	BeyondPricer public pricer;

	//////////////////////////
	/// constant variables ///
	//////////////////////////

	// BIPS
	uint256 private constant MAX_BPS = 10_000;
	// oToken decimals
	uint8 private constant OPYN_DECIMALS = 8;

	/////////////////////////
	/// structs && events ///
	/////////////////////////

	event SeriesApproved(uint64 expiration, uint128 strike, bool isPut, bool isBuying, bool isSelling);
	event SeriesDisabled(uint64 expiration, uint128 strike, bool isPut);
	event SeriesAltered(uint64 expiration, uint128 strike, bool isPut, bool isBuying, bool isSelling);

	error UnapprovedOption(uint256 index);

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
	 * @notice issue an option series for buying or sale
	 * @param  options option type to approve - strike in e18
	 * @dev    only callable by the manager
	 */
	function issueNewSeries(Types.Option[] memory options) external nonReentrant {
		_onlyManager();
		uint256 addressLength = options.length;
		for (uint256 i = 0; i < addressLength; i++) {
			Types.Option memory o = options[i];
			// make sure the strike gets formatted properly
			uint128 strike = uint128(formatStrikePrice(o.strike, collateralAsset)) * 10**10;
			bytes32 optionHash = keccak256(abi.encodePacked(o.expiration, strike, o.isPut));

			if (approvedOptions[optionHash]) {
				continue;
			}
			// store information on the series
			approvedOptions[optionHash] = true;
			isBuying[optionHash] = o.isBuying;
			isSelling[optionHash] = o.isSelling;
			// store it in some form of array
			if (
				optionDetails[o.expiration][true].length == 0 && optionDetails[o.expiration][false].length == 0
			) {
				expirations.push(o.expiration);
			}
			optionDetails[o.expiration][o.isPut].push(strike);
			// emit an event of the series creation, now users can write options on this series
			emit SeriesApproved(o.expiration, strike, o.isPut, o.isBuying, o.isSelling);
		}
	}

	/**
	 * @notice change whether an issued option is for buy or sale
	 * @param  options option type to change status on - strike in e18
	 * @dev    only callable by the manager
	 */
	function changeOptionBuyOrSell(Types.Option[] memory options) external nonReentrant {
		_onlyManager();
		uint256 adLength = options.length;
		for (uint256 i = 0; i < adLength; i++) {
			Types.Option memory o = options[i];
			// make sure the strike gets formatted properly
			uint128 strike = uint128(formatStrikePrice(o.strike, collateralAsset)) * 10**10;
			bytes32 optionHash = keccak256(abi.encodePacked(o.expiration, strike, o.isPut));
			if (approvedOptions[optionHash]) {
				isBuying[optionHash] = o.isBuying;
				isSelling[optionHash] = o.isSelling;
				emit SeriesAltered(o.expiration, strike, o.isPut, o.isBuying, o.isSelling);
			} else {
				revert UnapprovedOption(i);
			}
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
		bytes32 oHash = keccak256(
			abi.encodePacked(optionSeries.expiration, optionSeries.strike * 1e10, optionSeries.isPut)
		);
		if (!approvedOptions[oHash]) {
			revert CustomErrors.UnapprovedSeries();
		}
		// check if the series is for sale
		if (!isSelling[oHash]) {
			revert CustomErrors.NotSellingSeries();
		}
		// convert the strike to e18 decimals for storage
		Types.OptionSeries memory seriesToStore = Types.OptionSeries(
			optionSeries.expiration,
			strikeDecimalConverted,
			optionSeries.isPut,
			underlyingAsset,
			strikeAsset,
			collateralAsset
		);
		// calculate premium and delta
		(uint256 premium, int256 delta) = pricer.quoteOptionPrice(seriesToStore, amount, false);
		SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(liquidityPool), premium);
		getPortfolioValuesFeed().updateStores(seriesToStore, int256(amount), 0, seriesAddress);
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
	 * @notice write a number of options for a given series configuration
	 * @param  optionSeries the option token series
	 * @param  amount       the number of options to mint expressed as 1e18
	 */
	function issueAndWriteOption(Types.OptionSeries memory optionSeries, uint256 amount)
		external
		whenNotPaused
		nonReentrant
		returns (uint256 optionAmount, address series)
	{
		// format the strike correctly
		uint128 strike = uint128(formatStrikePrice(optionSeries.strike, collateralAsset)) * 10**10;
		// check if the option series is approved
		bytes32 oHash = keccak256(abi.encodePacked(optionSeries.expiration, strike, optionSeries.isPut));
		if (!approvedOptions[oHash]) {
			revert CustomErrors.UnapprovedSeries();
		}
		// check if the series is for sale
		if (!isSelling[oHash]) {
			revert CustomErrors.NotSellingSeries();
		}
		// calculate premium
		(uint256 premium, int256 delta) = pricer.quoteOptionPrice(optionSeries, amount, false);
		SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(liquidityPool), premium);
		// write the option, optionAmount in e18
		(optionAmount, series) = liquidityPool.handlerIssueAndWriteOption(
			optionSeries,
			amount,
			premium,
			delta,
			msg.sender
		);
		getPortfolioValuesFeed().updateStores(optionSeries, int256(amount), 0, series);
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
		bytes32 oHash = keccak256(
			abi.encodePacked(optionSeries.expiration, optionSeries.strike * 1e10, optionSeries.isPut)
		);
		if (!approvedOptions[oHash]) {
			revert CustomErrors.UnapprovedSeries();
		}
		// check if the series is for buying
		if (!isBuying[oHash]) {
			revert CustomErrors.NotBuyingSeries();
		}
		// revert if the expiry is in the past
		if (optionSeries.expiration <= block.timestamp) {
			revert CustomErrors.OptionExpiryInvalid();
		}
		uint128 strikeDecimalConverted = uint128(
			OptionsCompute.convertFromDecimals(optionSeries.strike, ERC20(seriesAddress).decimals())
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
		// get quote on the option to buy back, always return the total values
		SafeTransferLib.safeTransferFrom(
			seriesAddress,
			msg.sender,
			address(liquidityPool),
			OptionsCompute.convertToDecimals(amount, ERC20(seriesAddress).decimals())
		);
		(uint256 premium, int256 delta) = pricer.quoteOptionPrice(seriesToStore, amount, true);
		getPortfolioValuesFeed().updateStores(seriesToStore, -int256(amount), 0, seriesAddress);
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
	 * @notice get list of all expirations ever activated
	 * @return list of expirations
	 */
	function getExpirations() external view returns (uint64[] memory) {
		return expirations;
	}

	/**
	 * @notice get list of all strikes for a specific expiration and flavour
	 * @return list of strikes for a specific expiry and flavour
	 */
	function getOptionDetails(uint64 expiration, bool isPut) external view returns (uint128[] memory) {
		return optionDetails[expiration][isPut];
	}

	//////////////////////////
	/// internal utilities ///
	//////////////////////////

	/**
	 * @notice Converts strike price to 1e8 format and floors least significant digits if needed
	 * @param  strikePrice strikePrice in 1e18 format
	 * @param  collateral address of collateral asset
	 * @return if the transaction succeeded
	 */
	function formatStrikePrice(uint256 strikePrice, address collateral) public view returns (uint256) {
		// convert strike to 1e8 format
		uint256 price = strikePrice / (10**10);
		uint256 collateralDecimals = ERC20(collateral).decimals();
		if (collateralDecimals >= OPYN_DECIMALS) return price;
		uint256 difference = OPYN_DECIMALS - collateralDecimals;
		// round floor strike to prevent errors in Gamma protocol
		return (price / (10**difference)) * (10**difference);
	}
}
