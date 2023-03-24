// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

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
import "./interfaces/IMarginCalculator.sol";
import "./interfaces/ILiquidityPool.sol";
import "./interfaces/IPortfolioValuesFeed.sol";
import "./interfaces/AddressBookInterface.sol";

import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";

/**
 *  @title Contract used for all user facing options interactions
 *  @dev Interacts with liquidityPool to write options and quote their prices.
 */
contract BeyondPricer is AccessControl, ReentrancyGuard {
	using PRBMathSD59x18 for int256;
	using PRBMathUD60x18 for uint256;

	struct DeltaBorrowRates {
		int sellLong; // when someone sells puts to DHV (we need to long to hedge)
		int sellShort; // when someone sells calls to DHV (we need to short to hedge)
		int buyLong; // when someone buys calls from DHV (we need to long to hedge)
		int buyShort; // when someone buys puts from DHV (we need to short to hedge)
	}

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

	// represents the lending rate of collateral used to collateralise short options by the DHV. denominated in 6 dps
	uint256 public collateralLendingRate;
	//  delta borrow rates for spread func. All denominated in 6 dps
	DeltaBorrowRates public deltaBorrowRates;

	//////////////////////////
	/// constant variables ///
	//////////////////////////

	// BIPS
	uint256 private constant SIX_DPS = 1_000_000;
	uint256 private constant ONE_YEAR_SECONDS = 31557600;
	// used to convert e18 to e8
	uint256 private constant SCALE_FROM = 10 ** 10;
	uint256 private constant ONE_DELTA = 100e18;
	uint256 private constant ONE_SCALE = 1e18;
	int256 private constant ONE_SCALE_INT = 1e18;
	int256 private constant SIX_DPS_INT = 1_000_000;

	/////////////////////////
	/// structs && events ///
	/////////////////////////

	event SlippageGradientMultipliersChanged();
	event DeltaBandWidthChanged(uint256 newDeltaBandWidth, uint256 oldDeltaBandWidth);
	event CollateralLendingRateChanged(
		uint256 newCollateralLendingRate,
		uint256 oldCollateralLendingRate
	);
	event DeltaBorrowRatesChanged(
		DeltaBorrowRates newDeltaBorrowRates,
		DeltaBorrowRates oldDeltaBorrowRates
	);
	event SlippageGradientChanged(uint256 newSlippageGradient, uint256 oldSlippageGradient);
	event FeePerContractChanged(uint256 newFeePerContract, uint256 oldFeePerContract);
	event RiskFreeRateChanged(uint256 newRiskFreeRate, uint256 oldRiskFreeRate);
	event BidAskIVSpreadChanged(uint256 newBidAskIVSpread, uint256 oldBidAskIVSpread);

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
		DeltaBorrowRates memory _deltaBorrowRates
	) AccessControl(IAuthority(_authority)) {
		// option delta can span a range of 100, so ensure delta bands match this range
		if (
			_callSlippageGradientMultipliers.length != ONE_DELTA / _deltaBandWidth ||
			_putSlippageGradientMultipliers.length != ONE_DELTA / _deltaBandWidth
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
		deltaBorrowRates = _deltaBorrowRates;
	}

	///////////////
	/// setters ///
	///////////////

	function setRiskFreeRate(uint256 _riskFreeRate) external {
		_onlyGovernor();
		emit RiskFreeRateChanged(_riskFreeRate, riskFreeRate);
		riskFreeRate = _riskFreeRate;
	}

	function setBidAskIVSpread(uint256 _bidAskIVSpread) external {
		_onlyGovernor();
		emit BidAskIVSpreadChanged(_bidAskIVSpread, bidAskIVSpread);
		bidAskIVSpread = _bidAskIVSpread;
	}

	function setFeePerContract(uint256 _feePerContract) external {
		_onlyGovernor();
		emit FeePerContractChanged(_feePerContract, feePerContract);
		feePerContract = _feePerContract;
	}

	function setSlippageGradient(uint256 _slippageGradient) external {
		_onlyManager();
		emit SlippageGradientChanged(_slippageGradient, slippageGradient);
		slippageGradient = _slippageGradient;
	}

	function setCollateralLendingRate(uint256 _collateralLendingRate) external {
		_onlyManager();
		emit CollateralLendingRateChanged(_collateralLendingRate, collateralLendingRate);
		collateralLendingRate = _collateralLendingRate;
	}

	function setDeltaBorrowRates(DeltaBorrowRates calldata _deltaBorrowRates) external {
		_onlyManager();
		emit DeltaBorrowRatesChanged(_deltaBorrowRates, deltaBorrowRates);
		deltaBorrowRates = _deltaBorrowRates;
	}

	/// @dev must also update delta band arrays to fit the new delta band width
	function setDeltaBandWidth(
		uint256 _deltaBandWidth,
		uint256[] memory _callSlippageGradientMultipliers,
		uint256[] memory _putSlippageGradientMultipliers
	) external {
		_onlyManager();
		emit DeltaBandWidthChanged(_deltaBandWidth, deltaBandWidth);
		deltaBandWidth = _deltaBandWidth;
		setSlippageGradientMultipliers(_callSlippageGradientMultipliers, _putSlippageGradientMultipliers);
	}

	function setSlippageGradientMultipliers(
		uint256[] memory _callSlippageGradientMultipliers,
		uint256[] memory _putSlippageGradientMultipliers
	) public {
		_onlyManager();
		if (
			_callSlippageGradientMultipliers.length != ONE_DELTA / deltaBandWidth ||
			_putSlippageGradientMultipliers.length != ONE_DELTA / deltaBandWidth
		) {
			revert InvalidSlippageGradientMultipliersArrayLength();
		}
		for (uint256 i = 0; i < _callSlippageGradientMultipliers.length; i++) {
			// arrays must be same length so can check both in same loop
			// ensure no multiplier is less than 1 due to human error.
			if (
				_callSlippageGradientMultipliers[i] < ONE_SCALE ||
				_putSlippageGradientMultipliers[i] < ONE_SCALE
			) {
				revert InvalidSlippageGradientMultiplierValue();
			}
		}
		callSlippageGradientMultipliers = _callSlippageGradientMultipliers;
		putSlippageGradientMultipliers = _putSlippageGradientMultipliers;
		emit SlippageGradientMultipliersChanged();
	}

	///////////////////////
	/// complex getters ///
	///////////////////////

	function quoteOptionPrice(
		Types.OptionSeries memory _optionSeries,
		uint256 _amount,
		bool isSell,
		int256 netDhvExposure
	) external view returns (uint256 totalPremium, int256 totalDelta, uint256 totalFees) {
		uint256 underlyingPrice = _getUnderlyingPrice(underlyingAsset, strikeAsset);
		(uint256 iv, uint256 forward) = _getVolatilityFeed().getImpliedVolatilityWithForward(
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
			forward
		);
		vanillaPremium = vanillaPremium.mul(underlyingPrice).div(forward);
		uint256 premium = vanillaPremium.mul(
			_getSlippageMultiplier(_amount, delta, netDhvExposure, isSell)
		);
		int spread = _getSpreadValue(
			isSell,
			_optionSeries,
			_amount,
			delta,
			netDhvExposure,
			underlyingPrice
		);
		if (spread < 0) {
			spread = 0;
		}

		// the delta returned is the delta of a long position of the option the sign of delta should be handled elsewhere.

		totalDelta = delta.mul(int256(_amount));
		totalFees = feePerContract.mul(_amount);
		totalPremium = OptionsCompute.convertToDecimals(
			isSell ? premium.mul(_amount) - uint(spread) : premium.mul(_amount) + uint(spread),
			ERC20(collateralAsset).decimals()
		);
	}

	///////////////////////////
	/// non-complex getters ///
	///////////////////////////

	function getCallSlippageGradientMultipliers() external view returns (uint256[] memory) {
		return callSlippageGradientMultipliers;
	}

	function getPutSlippageGradientMultipliers() external view returns (uint256[] memory) {
		return putSlippageGradientMultipliers;
	}

	/**
	 * @notice get the underlying price with just the underlying asset and strike asset
	 * @param underlying   the asset that is used as the reference asset
	 * @param _strikeAsset the asset that the underlying value is denominated in
	 * @return the underlying price
	 */
	function _getUnderlyingPrice(
		address underlying,
		address _strikeAsset
	) internal view returns (uint256) {
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
			slippageMultiplier = ONE_SCALE;
			return slippageMultiplier;
		}
		// integrate the exponential function to get the slippage multiplier as this represents the average exposure
		// if it is a sell then we need to do lower bound is old exposure exponent, upper bound is new exposure exponent
		// if it is a buy then we need to do lower bound is new exposure exponent, upper bound is old exposure exponent
		int256 slippageFactor = int256(ONE_SCALE + modifiedSlippageGradient);
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

	/**
	 * @notice function to apply an additive spread premium to the order. Is applied to whole _amount and not per contract.
	 * @param _optionSeries the series detail of the option - strike decimals in e18
	 * @param _amount number of contracts being traded. e18
	 * @param _optionDelta the delta exposure of the option. e18
	 * @param _netDhvExposure how many contracts of this series the DHV is already exposed to. e18. negative if net short.
	 * @param _underlyingPrice the price of the underlying asset. e18
	 */
	function _getSpreadValue(
		bool _isSell,
		Types.OptionSeries memory _optionSeries,
		uint256 _amount,
		int256 _optionDelta,
		int256 _netDhvExposure,
		uint256 _underlyingPrice
	) internal view returns (int256 spreadPremium) {
		// get duration of option in years
		uint256 time = (_optionSeries.expiration - block.timestamp).div(ONE_YEAR_SECONDS);
		if (!_isSell) {
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
			if (_optionSeries.collateral == collateralAsset) {
				// find collateral requirements for net short options
				uint256 collateralToLend = _getCollateralRequirements(_optionSeries, netShortContracts);
				// calculate the collateral cost portion of the spread
				uint256 collateralLendingPremium = (
					(ONE_SCALE + (collateralLendingRate * ONE_SCALE) / SIX_DPS).pow(time)
				).mul(collateralToLend) - collateralToLend;
				spreadPremium += int(collateralLendingPremium);
			}
		}
		// calculate delta borrow premium on both buy and sells
		// this is just a magnitude value, sign doesnt matter
		int256 dollarDelta = int(uint256(_optionDelta.abs()).mul(_amount).mul(_underlyingPrice));
		int256 deltaBorrowPremium;
		if (_optionDelta < 0) {
			// option is negative delta, resulting in long delta exposure for DHV. needs hedging with a short pos
			deltaBorrowPremium =
				dollarDelta.mul(
					(ONE_SCALE_INT +
						((_isSell ? deltaBorrowRates.sellLong : deltaBorrowRates.buyShort) * ONE_SCALE_INT) /
						SIX_DPS_INT).pow(int(time))
				) -
				dollarDelta;
		} else {
			// option is positive delta, resulting in short delta exposure for DHV. needs hedging with a long pos
			deltaBorrowPremium =
				dollarDelta.mul(
					(ONE_SCALE_INT +
						((_isSell ? deltaBorrowRates.sellShort : deltaBorrowRates.buyLong) * ONE_SCALE_INT) /
						SIX_DPS_INT).pow(int(time))
				) -
				dollarDelta;
		}

		spreadPremium += deltaBorrowPremium;
	}

	function _getCollateralRequirements(
		Types.OptionSeries memory _optionSeries,
		uint256 _amount
	) internal view returns (uint256) {
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
