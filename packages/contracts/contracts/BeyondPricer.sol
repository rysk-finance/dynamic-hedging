// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./Protocol.sol";
import "./PriceFeed.sol";
import "./VolatilityFeed.sol";
import "./tokens/ERC20.sol";
import "./libraries/Types.sol";
import "./utils/ReentrancyGuard.sol";
import "./libraries/CustomErrors.sol";
import "./libraries/AccessControl.sol";
import "./libraries/OptionsCompute.sol";
import "./libraries/SafeTransferLib.sol";

import "./interfaces/IOracle.sol";
import "./interfaces/IOptionRegistry.sol";
import "./interfaces/IMarginCalculator.sol";
import "./interfaces/ILiquidityPool.sol";
import "./interfaces/IPortfolioValuesFeed.sol";
import "./interfaces/AddressBookInterface.sol";

import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "hardhat/console.sol";

/**
 *  @title Contract used for all user facing options interactions
 *  @dev Interacts with liquidityPool to write options and quote their prices.
 */
contract BeyondPricer is AccessControl, ReentrancyGuard {
	using PRBMathSD59x18 for int256;
	using PRBMathUD60x18 for uint256;

	///////////////////////////
	/// immutable variables ///
	///////////////////////////

	// Protocol management contracts
	ILiquidityPool public immutable liquidityPool;
	Protocol public immutable protocol;
	AddressBookInterface public immutable addressBook;
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

	uint256 public bidAskIVSpread;
	uint256 public riskFreeRate;
	uint256 public feePerContract = 3e5;

	uint256 public slippageGradient;

	// multiplier of slippageGradient for options < 10 delta
	// reflects the cost of increased collateral used to back these kind of options relative to their price.
	// represents the width of delta bands to apply slippage multipliers to. e18
	uint256 public deltaBandWidth;
	// array of slippage multipliers for each delta band. e18
	uint256[] public callSlippageGradientMultipliers;
	uint256[] public putSlippageGradientMultipliers;

	// represents the lending rate of collateral used to collateralise short options by the DHV. denominated in bips
	uint256 public collateralLendingRate;
	// long delta borrow rate. denominated in bips
	uint256 public longDeltaBorrowRate;
	// short delta borrow rate. denominated in bips
	uint256 public shortDeltaBorrowRate;

	//////////////////////////
	/// constant variables ///
	//////////////////////////

	// BIPS
	uint256 private constant MAX_BPS = 10_000;
	uint256 private constant ONE_YEAR_SECONDS = 31557600;
	// used to convert e18 to e8
	uint256 private constant SCALE_FROM = 10**10;

	/////////////////////////
	/// structs && events ///
	/////////////////////////

	event FeePerContractChanged(uint256 newFeePerContract, uint256 oldFeePerContract);

	error InvalidSlippageGradientMultipliersArrayLength();
	error InvalidSlippageGradientMultiplierValue();

	constructor(
		address _authority,
		address _protocol,
		address _liquidityPool,
		address _addressBook,
		uint256 _slippageGradient,
		uint256 _deltaBandWidth,
		uint256[] memory _callSlippageGradientMultipliers,
		uint256[] memory _putSlippageGradientMultipliers,
		uint256 _collateralLendingRate,
		uint256 _shortDeltaBorrowRate,
		uint256 _longDeltaBorrowRate
	) AccessControl(IAuthority(_authority)) {
		// option delta can span a range of 100, so ensure delta bands match this range
		if (
			_callSlippageGradientMultipliers.length != 100e18 / _deltaBandWidth ||
			_putSlippageGradientMultipliers.length != 100e18 / _deltaBandWidth
		) {
			revert InvalidSlippageGradientMultipliersArrayLength();
		}
		protocol = Protocol(_protocol);
		liquidityPool = ILiquidityPool(_liquidityPool);
		addressBook = AddressBookInterface(_addressBook);
		collateralAsset = liquidityPool.collateralAsset();
		underlyingAsset = liquidityPool.underlyingAsset();
		strikeAsset = liquidityPool.strikeAsset();
		slippageGradient = _slippageGradient;
		deltaBandWidth = _deltaBandWidth;
		callSlippageGradientMultipliers = _callSlippageGradientMultipliers;
		putSlippageGradientMultipliers = _putSlippageGradientMultipliers;
		collateralLendingRate = _collateralLendingRate;
		shortDeltaBorrowRate = _shortDeltaBorrowRate;
		longDeltaBorrowRate = _longDeltaBorrowRate;
	}

	///////////////
	/// setters ///
	///////////////

	function setFeePerContract(uint256 _feePerContract) external {
		_onlyGovernor();
		feePerContract = _feePerContract;
		emit FeePerContractChanged(_feePerContract, feePerContract);
	}

	function setSlippageGradient(uint256 _slippageGradient) external {
		_onlyGuardian();
		slippageGradient = _slippageGradient;
	}

	function setCollateralLendingRate(uint256 _collateralLendingRate) external {
		_onlyGovernor();
		collateralLendingRate = _collateralLendingRate;
	}

	function setShortDeltaBorrowRate(uint256 _shortDeltaBorrowRate) external {
		_onlyGovernor();
		shortDeltaBorrowRate = _shortDeltaBorrowRate;
	}

	function setLongDeltaBorrowRate(uint256 _longDeltaBorrowRate) external {
		_onlyGovernor();
		longDeltaBorrowRate = _longDeltaBorrowRate;
	}

	/// @dev must also update delta band arrays to fit the new delta band width
	function setDeltaBandWidth(
		uint256 _deltaBandWidth,
		uint256[] memory _callSlippageGradientMultipliers,
		uint256[] memory _putSlippageGradientMultipliers
	) external {
		_onlyGuardian();
		deltaBandWidth = _deltaBandWidth;
		setSlippageGradientMultipliers(_callSlippageGradientMultipliers, _putSlippageGradientMultipliers);
	}

	function setSlippageGradientMultipliers(
		uint256[] memory _callSlippageGradientMultipliers,
		uint256[] memory _putSlippageGradientMultipliers
	) public {
		_onlyGuardian();
		if (
			_callSlippageGradientMultipliers.length != 100e18 / deltaBandWidth ||
			_putSlippageGradientMultipliers.length != 100e18 / deltaBandWidth
		) {
			revert InvalidSlippageGradientMultipliersArrayLength();
		}
		for (uint256 i = 0; i < _callSlippageGradientMultipliers.length; i++) {
			// arrays must be same length so can check both in same loop
			// ensure no multiplier is less than 1 due to human error.
			if (_callSlippageGradientMultipliers[i] < 1e18 || _putSlippageGradientMultipliers[i] < 1e18) {
				revert InvalidSlippageGradientMultiplierValue();
			}
		}
		callSlippageGradientMultipliers = _callSlippageGradientMultipliers;
		putSlippageGradientMultipliers = _putSlippageGradientMultipliers;
	}

	//////////////////////////////////////////////////////
	/// access-controlled state changing functionality ///
	//////////////////////////////////////////////////////

	///////////////////////
	/// complex getters ///
	///////////////////////

	function quoteOptionPrice(
		Types.OptionSeries memory _optionSeries,
		uint256 _amount,
		bool isSell,
		int256 netDhvExposure
	)
		external
		view
		returns (
			uint256 totalPremium,
			int256 totalDelta,
			uint256 totalFees
		)
	{
		uint256 underlyingPrice = _getUnderlyingPrice(underlyingAsset, strikeAsset);
		uint256 iv = _getVolatilityFeed().getImpliedVolatility(
			_optionSeries.isPut,
			underlyingPrice,
			_optionSeries.strike,
			_optionSeries.expiration
		);
		(uint256 vanillaPremium, int256 delta) = OptionsCompute.quotePriceGreeks(
			_optionSeries,
			isSell,
			bidAskIVSpread,
			riskFreeRate,
			iv,
			underlyingPrice
		);
		uint256 premium = vanillaPremium.mul(
			_getSlippageMultiplier(_amount, delta, netDhvExposure, isSell)
		);
		uint256 spread;
		if (!isSell) {
			// user is buying from DHV, so add spread to the price
			spread = _getSpreadValue(_optionSeries, _amount, delta, netDhvExposure, underlyingPrice);
		}
		console.log("solidity vanilla premium:", vanillaPremium / 1e18, spread / 1e18);
		// note the delta returned is the delta of a long position of the option the sign of delta should be handled elsewhere.
		totalPremium = (premium.mul(_amount) + spread) / 1e12;
		totalDelta = delta.mul(int256(_amount));
		totalFees = feePerContract.mul(_amount);
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

	/**
	 * @notice get the volatility feed used by the liquidity pool
	 * @return the volatility feed contract interface
	 */
	function _getVolatilityFeed() internal view returns (VolatilityFeed) {
		return VolatilityFeed(protocol.volatilityFeed());
	}

	//////////////////////////
	/// internal functions ///
	//////////////////////////

	/**
	 * @notice function to add slippage to orders to prevent over-exposure to a single option type
	 * @param _amount amount of options contracts being traded. e18
	 * @param _optionDelta the delta exposure of the option
	 * @param _netDhvExposure how many contracts of this series the DHV is already exposed to. e18. negative if net short.
	 * @param _isSell true if someone is selling option to DHV. False if they're buying from DHV
	 */
	function _getSlippageMultiplier(
		uint256 _amount,
		int256 _optionDelta,
		int256 _netDhvExposure,
		bool _isSell
	) internal view returns (uint256 slippageMultiplier) {
		// divide _amount by 2 to obtain the average exposure throughout the tx. Stops large orders being disproportionately penalised.
		// slippage will be exponential with the exponent being the DHV's net exposure
		int256 newExposureExponent = _isSell
			? _netDhvExposure + int256(_amount)
			: _netDhvExposure - int256(_amount);
		int256 oldExposureExponent = _netDhvExposure;
		uint256 modifiedSlippageGradient;
		// not using math library here, want to reduce to a non e18 integer
		// integer division rounds down to nearest integer
		uint256 deltaBandIndex = (uint256(_optionDelta.abs()) * 100) / deltaBandWidth;
		if (_optionDelta > 0) {
			modifiedSlippageGradient = slippageGradient.mul(callSlippageGradientMultipliers[deltaBandIndex]);
		} else {
			modifiedSlippageGradient = slippageGradient.mul(putSlippageGradientMultipliers[deltaBandIndex]);
		}
		if (slippageGradient == 0) {
			slippageMultiplier = 1e18;
			return slippageMultiplier;
		}
		// if it is a sell then we need to do lower bound is old exposure exponent, upper bound is new exposure exponent
		// if it is a buy then we need to do lower bound is new exposure exponent, upper bound is old exposure exponent
		int256 slippageFactor = int256(1e18 + modifiedSlippageGradient);
		if (_isSell) {
			slippageMultiplier = uint256(
				(slippageFactor.pow(-oldExposureExponent) - slippageFactor.pow(-newExposureExponent)).div(
					slippageFactor.ln()
				)
			).div(_amount);
		} else {
			slippageMultiplier = uint256(
				(slippageFactor.pow(-newExposureExponent) - slippageFactor.pow(-oldExposureExponent)).div(
					slippageFactor.ln()
				)
			).div(_amount);
		}
	}

	function _getSpreadValue(
		Types.OptionSeries memory _optionSeries,
		uint256 _amount,
		int256 _optionDelta,
		int256 _netDhvExposure,
		uint256 _underlyingPrice
	) internal view returns (uint256 spreadPremium) {
		uint256 netShortContracts;
		if (_netDhvExposure <= 0) {
			// dhv is already short so apply collateral lending spread to all traded contracts
			netShortContracts = _amount;
		} else {
			// dhv is long so only apply spread to those contracts which make it net short.
			netShortContracts = int256(_amount) - _netDhvExposure < 0
				? 0
				: _amount - uint256(_netDhvExposure);
		}
		// find collateral requirements for net short options
		uint256 collateralToLend = _getCollateralRequirements(_optionSeries, netShortContracts);

		console.log(
			"collateral to lend",
			collateralToLend,
			netShortContracts / 1e18,
			_underlyingPrice / 1e18
		);

		// get duration of option in years
		uint256 time = (_optionSeries.expiration - block.timestamp).div(ONE_YEAR_SECONDS);
		console.log("params", _optionSeries.underlying, _optionSeries.collateral);

		console.log("params", _optionSeries.strike / 1e18, _optionSeries.isPut, time / 1e16);
		// calculate the collateral cost portion of the spread
		uint256 collateralLendingPremium = ((1e18 + (collateralLendingRate * 1e18) / MAX_BPS).pow(time))
			.mul(collateralToLend) - collateralToLend;
		// this is just a magnitude value, sign doesnt matter
		uint256 dollarDelta = uint256(_optionDelta.abs()).mul(_amount).mul(_underlyingPrice);
		uint256 deltaBorrowPremium;
		if (_optionDelta < 0) {
			// option is negative delta, resulting in long exposure for DHV
			deltaBorrowPremium =
				dollarDelta.mul((1e18 + (shortDeltaBorrowRate * 1e18) / MAX_BPS).pow(time)) -
				dollarDelta;
		} else {
			// option is positive delta, resulting in short exposure for DHV
			deltaBorrowPremium =
				dollarDelta.mul((1e18 + (longDeltaBorrowRate * 1e18) / MAX_BPS).pow(time)) -
				dollarDelta;
		}
		console.log("solidity:", collateralLendingPremium, deltaBorrowPremium);
		console.log("SPREAD VALUE:", collateralLendingPremium + deltaBorrowPremium);
		return collateralLendingPremium + deltaBorrowPremium;
	}

	function _getCollateralRequirements(Types.OptionSeries memory _optionSeries, uint256 _amount)
		internal
		view
		returns (uint256)
	{
		IMarginCalculator marginCalc = IMarginCalculator(addressBook.getMarginCalculator());

		return
			marginCalc.getNakedMarginRequired(
				_optionSeries.underlying,
				_optionSeries.strikeAsset,
				_optionSeries.collateral,
				_amount / SCALE_FROM,
				_optionSeries.strike / SCALE_FROM, // assumes in e18
				IOracle(addressBook.getOracle()).getPrice(_optionSeries.underlying),
				_optionSeries.expiration,
				18, // always have the value return in e18
				_optionSeries.isPut
			);
	}
}
