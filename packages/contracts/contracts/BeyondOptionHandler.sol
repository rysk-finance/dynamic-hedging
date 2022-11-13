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

	/////////////////////////////////////
	/// governance settable variables ///
	/////////////////////////////////////

	// pricer contract used for pricing options
	BeyondPricer public pricer;
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

	//////////////////////////
	/// constant variables ///
	//////////////////////////

	// BIPS
	uint256 private constant MAX_BPS = 10_000;
	// oToken decimals
	uint8 private constant OPYN_DECIMALS = 8;
	// scale otoken conversion decimals
	uint8 private constant CONVERSION_DECIMALS = 18 - OPYN_DECIMALS;

	/////////////////////////
	/// structs && events ///
	/////////////////////////

	event SeriesApproved(uint64 expiration, uint128 strike, bool isPut, bool isBuying, bool isSelling);
	event SeriesDisabled(uint64 expiration, uint128 strike, bool isPut);
	event SeriesAltered(uint64 expiration, uint128 strike, bool isPut, bool isBuying, bool isSelling);

	constructor(
		address _authority,
		address _protocol,
		address _liquidityPool,
		address _pricer
	) AccessControl(IAuthority(_authority)) {
		protocol = Protocol(_protocol);
		liquidityPool = ILiquidityPool(_liquidityPool);
		collateralAsset = liquidityPool.collateralAsset();
		underlyingAsset = liquidityPool.underlyingAsset();
		strikeAsset = liquidityPool.strikeAsset();
		pricer = BeyondPricer(_pricer);
	}

	///////////////
	/// setters ///
	///////////////

	function pause() external {
		_onlyGuardian();
		_pause();
	}

	function unpause() external {
		_onlyGuardian();
		_unpause();
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
			uint128 strike = uint128(
				formatStrikePrice(o.strike, collateralAsset) * 10**(CONVERSION_DECIMALS)
			);
			// get the hash of the option (how the option is stored on the books)
			bytes32 optionHash = keccak256(abi.encodePacked(o.expiration, strike, o.isPut));
			// if the option is already issued then skip it
			if (approvedOptions[optionHash]) {
				continue;
			}
			// store information on the series
			approvedOptions[optionHash] = true;
			isBuying[optionHash] = o.isBuying;
			isSelling[optionHash] = o.isSelling;
			// store it in an array, these are mainly for frontend/informational use
			// if the strike array is empty for calls and puts for that expiry it means that this expiry hasnt been issued yet
			// so we should save the expory
			if (
				optionDetails[o.expiration][true].length == 0 && optionDetails[o.expiration][false].length == 0
			) {
				expirations.push(o.expiration);
			}
			// we wouldnt get here if the strike already existed, so we store it in the array
			// there shouldnt be any duplicates in the strike array or expiration array
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
			// make sure the strike gets formatted properly, we get it to e8 format in the converter
			// then convert it back to e18
			uint128 strike = uint128(
				formatStrikePrice(o.strike, collateralAsset) * 10**(CONVERSION_DECIMALS)
			);
			// get the option hash
			bytes32 optionHash = keccak256(abi.encodePacked(o.expiration, strike, o.isPut));
			// if its already approved then we can change its parameters, if its not approved then revert as there is a mistake
			if (approvedOptions[optionHash]) {
				isBuying[optionHash] = o.isBuying;
				isSelling[optionHash] = o.isSelling;
				emit SeriesAltered(o.expiration, strike, o.isPut, o.isBuying, o.isSelling);
			} else {
				revert CustomErrors.UnapprovedSeries();
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
		// make sure the expiry actually exists
		if (optionSeries.expiration == 0) {
			revert CustomErrors.NonExistentOtoken();
		}
		// concert the strike to e18 decimals
		uint128 strikeDecimalConverted = uint128(
			OptionsCompute.convertFromDecimals(optionSeries.strike, ERC20(seriesAddress).decimals())
		);
		// check if the option series is approved using the e18 strike value
		bytes32 oHash = keccak256(
			abi.encodePacked(optionSeries.expiration, strikeDecimalConverted, optionSeries.isPut)
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
		// calculate premium and delta from the option pricer, returning the premium in collateral decimals and delta in e18
		(uint256 premium, int256 delta) = pricer.quoteOptionPrice(seriesToStore, amount, false);
		// transfer the premium from the user to the liquidity pool
		SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(liquidityPool), premium);
		// add this series to the portfolio values feed so its stored on the book
		getPortfolioValuesFeed().updateStores(seriesToStore, int256(amount), 0, seriesAddress);
		// get the liquidity pool to write the option
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
	 * @notice issue the otoken and write a number of options for a given series configuration
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
		uint128 strike = uint128(
			formatStrikePrice(optionSeries.strike, collateralAsset) * 10**CONVERSION_DECIMALS
		);
		// check if the option series is approved
		bytes32 oHash = keccak256(abi.encodePacked(optionSeries.expiration, strike, optionSeries.isPut));
		if (!approvedOptions[oHash]) {
			revert CustomErrors.UnapprovedSeries();
		}
		// check if the series is for sale
		if (!isSelling[oHash]) {
			revert CustomErrors.NotSellingSeries();
		}
		// calculate premium and delta from the pricer, returning the premium in collateral decimals and delta in e18
		(uint256 premium, int256 delta) = pricer.quoteOptionPrice(optionSeries, amount, false);
		// transfer the funds from the user to the liquidity pool
		SafeTransferLib.safeTransferFrom(collateralAsset, msg.sender, address(liquidityPool), premium);
		// write the option, optionAmount in e18
		(optionAmount, series) = liquidityPool.handlerIssueAndWriteOption(
			optionSeries,
			amount,
			premium,
			delta,
			msg.sender
		);
		// add this series to the portfolio values feed so its stored on the book
		getPortfolioValuesFeed().updateStores(
			Types.OptionSeries(
				optionSeries.expiration,
				strike,
				optionSeries.isPut,
				underlyingAsset,
				strikeAsset,
				collateralAsset
			),
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
		whenNotPaused
		nonReentrant
		returns (uint256)
	{
		IOptionRegistry optionRegistry = getOptionRegistry();
		// get the option series from the pool
		Types.OptionSeries memory optionSeries = optionRegistry.getSeriesInfo(seriesAddress);
		uint128 strikeDecimalConverted = uint128(
			OptionsCompute.convertFromDecimals(optionSeries.strike, ERC20(seriesAddress).decimals())
		);
		// check if the option series is approved
		bytes32 oHash = keccak256(
			abi.encodePacked(optionSeries.expiration, strikeDecimalConverted, optionSeries.isPut)
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
		// update the series on the stores
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
