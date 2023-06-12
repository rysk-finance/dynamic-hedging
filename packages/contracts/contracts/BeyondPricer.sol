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

import "hardhat/console.sol";

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

	struct DeltaBandMultipliers {
		// array of slippage multipliers for each delta band. e18
		uint80[] callSlippageGradientMultipliers;
		uint80[] putSlippageGradientMultipliers;
		// array of collateral lending spread multipliers for each delta band. e18
		uint80[] callSpreadCollateralMultipliers;
		uint80[] putSpreadCollateralMultipliers;
		// array of delta borrow spread multipliers for each delta band. e18
		int80[] callSpreadDeltaMultipliers;
		int80[] putSpreadDeltaMultipliers;
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
	// represents the number of tenors for which we want to apply separate slippage and spread parameters to
	uint256 public numberOfTenors;
	// multiplier values for spread and slippage delta bands
	DeltaBandMultipliers[] internal tenorPricingParams;
	// maximum tenor value. Units are in sqrt(seconds)
	uint16 public maxTenorValue;

	// represents the lending rate of collateral used to collateralise short options by the DHV. denominated in 6 dps
	uint256 public collateralLendingRate;
	//  delta borrow rates for spread func. All denominated in 6 dps
	DeltaBorrowRates public deltaBorrowRates;
	// flat IV value which will override our pricing formula for bids on options below a low delta threshold
	uint256 public lowDeltaSellOptionFlatIV = 35e16;
	// threshold for delta of options below which lowDeltaSellOptionFlatIV kicks in
	uint256 public lowDeltaThreshold = 5e16; //0.05 delta options

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

	event TenorParamsSet();
	event SlippageGradientMultipliersChanged();
	event SpreadCollateralMultipliersChanged();
	event SpreadDeltaMultipliersChanged();
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
	event LowDeltaSellOptionFlatIVChanged(
		uint256 newLowDeltaSellOptionFlatIV,
		uint256 oldLowDeltaSellOptionFlatIV
	);
	event LowDeltaThresholdChanged(uint256 newLowDeltaThreshold, uint256 oldLowDeltaThreshold);
	error InvalidMultipliersArrayLength();
	error InvalidSlippageGradientMultiplierValue();
	error InvalidSpreadCollateralMultiplierValue();
	error InvalidSpreadDeltaMultiplierValue();
	error InvalidTenorArrayLength();

	constructor(
		address _authority,
		address _protocol,
		address _liquidityPool,
		address _addressBook,
		uint256 _slippageGradient,
		uint256 _deltaBandWidth,
		uint16 _numberOfTenors,
		uint16 _maxTenorValue,
		uint256 _collateralLendingRate,
		DeltaBorrowRates memory _deltaBorrowRates
	) AccessControl(IAuthority(_authority)) {
		protocol = Protocol(_protocol);
		liquidityPool = ILiquidityPool(_liquidityPool);
		addressBook = AddressBookInterface(_addressBook);
		collateralAsset = liquidityPool.collateralAsset();
		underlyingAsset = liquidityPool.underlyingAsset();
		strikeAsset = liquidityPool.strikeAsset();
		slippageGradient = _slippageGradient;
		collateralLendingRate = _collateralLendingRate;
		deltaBorrowRates = _deltaBorrowRates;
	}

	///////////////
	/// setters ///
	///////////////

	function setLowDeltaSellOptionFlatIV(uint256 _lowDeltaSellOptionFlatIV) external {
		_onlyManager();
		emit LowDeltaSellOptionFlatIVChanged(_lowDeltaSellOptionFlatIV, lowDeltaSellOptionFlatIV);
		lowDeltaSellOptionFlatIV = _lowDeltaSellOptionFlatIV;
	}

	function setLowDeltaThreshold(uint256 _lowDeltaThreshold) external {
		_onlyManager();
		emit LowDeltaThresholdChanged(_lowDeltaThreshold, lowDeltaThreshold);
		lowDeltaThreshold = _lowDeltaThreshold;
	}

	function setRiskFreeRate(uint256 _riskFreeRate) external {
		_onlyManager();
		emit RiskFreeRateChanged(_riskFreeRate, riskFreeRate);
		riskFreeRate = _riskFreeRate;
	}

	function setBidAskIVSpread(uint256 _bidAskIVSpread) external {
		_onlyManager();
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

	/** @notice function used to set the slippage and spread delta band multipliers initially, and
	 *  also if the number of tenors or the delta band width is changed, since this would require
	 *  all existing tenors to be adjusted.
	 */

	function initializeTenorParams(
		uint256 _deltaBandWidth,
		uint16 _numberOfTenors,
		uint16 _maxTenorValue,
		DeltaBandMultipliers[] memory _tenorPricingParams
	) external {
		_onlyManager();
		if (_tenorPricingParams.length != _numberOfTenors) {
			revert InvalidTenorArrayLength();
		}
		for (uint16 i = 0; i < _numberOfTenors; i++) {
			if (
				_tenorPricingParams[i].callSlippageGradientMultipliers.length != ONE_DELTA / _deltaBandWidth ||
				_tenorPricingParams[i].putSlippageGradientMultipliers.length != ONE_DELTA / _deltaBandWidth ||
				_tenorPricingParams[i].callSpreadCollateralMultipliers.length != ONE_DELTA / _deltaBandWidth ||
				_tenorPricingParams[i].putSpreadCollateralMultipliers.length != ONE_DELTA / _deltaBandWidth ||
				_tenorPricingParams[i].callSpreadDeltaMultipliers.length != ONE_DELTA / _deltaBandWidth ||
				_tenorPricingParams[i].putSpreadDeltaMultipliers.length != ONE_DELTA / _deltaBandWidth
			) {
				revert InvalidMultipliersArrayLength();
			}
		}
		numberOfTenors = _numberOfTenors;
		maxTenorValue = _maxTenorValue;
		deltaBandWidth = _deltaBandWidth;
		delete tenorPricingParams;
		for (uint i = 0; i < _numberOfTenors; i++) {
			tenorPricingParams.push(_tenorPricingParams[i]);
		}
		emit TenorParamsSet();
	}

	function setSlippageGradientMultipliers(
		uint16 _tenorIndex,
		uint80[] memory _callSlippageGradientMultipliers,
		uint80[] memory _putSlippageGradientMultipliers
	) public {
		_onlyManager();
		if (
			_callSlippageGradientMultipliers.length != ONE_DELTA / deltaBandWidth ||
			_putSlippageGradientMultipliers.length != ONE_DELTA / deltaBandWidth
		) {
			revert InvalidMultipliersArrayLength();
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
		tenorPricingParams[_tenorIndex]
			.callSlippageGradientMultipliers = _callSlippageGradientMultipliers;
		tenorPricingParams[_tenorIndex].putSlippageGradientMultipliers = _putSlippageGradientMultipliers;
		emit SlippageGradientMultipliersChanged();
	}

	function setSpreadCollateralMultipliers(
		uint16 _tenorIndex,
		uint80[] memory _callSpreadCollateralMultipliers,
		uint80[] memory _putSpreadCollateralMultipliers
	) public {
		_onlyManager();
		if (
			_callSpreadCollateralMultipliers.length != ONE_DELTA / deltaBandWidth ||
			_putSpreadCollateralMultipliers.length != ONE_DELTA / deltaBandWidth
		) {
			revert InvalidMultipliersArrayLength();
		}
		for (uint256 i = 0; i < _callSpreadCollateralMultipliers.length; i++) {
			// arrays must be same length so can check both in same loop
			// ensure no multiplier is less than 1 due to human error.
			if (
				_callSpreadCollateralMultipliers[i] < ONE_SCALE ||
				_putSpreadCollateralMultipliers[i] < ONE_SCALE
			) {
				revert InvalidSpreadCollateralMultiplierValue();
			}
		}
		tenorPricingParams[_tenorIndex]
			.callSpreadCollateralMultipliers = _callSpreadCollateralMultipliers;
		tenorPricingParams[_tenorIndex].putSpreadCollateralMultipliers = _putSpreadCollateralMultipliers;
		emit SpreadCollateralMultipliersChanged();
	}

	function setSpreadDeltaMultipliers(
		uint16 _tenorIndex,
		int80[] memory _callSpreadDeltaMultipliers,
		int80[] memory _putSpreadDeltaMultipliers
	) public {
		_onlyManager();
		if (
			_callSpreadDeltaMultipliers.length != ONE_DELTA / deltaBandWidth ||
			_putSpreadDeltaMultipliers.length != ONE_DELTA / deltaBandWidth
		) {
			revert InvalidMultipliersArrayLength();
		}
		for (uint256 i = 0; i < _callSpreadDeltaMultipliers.length; i++) {
			// arrays must be same length so can check both in same loop
			// ensure no multiplier is less than 1 due to human error.
			if (
				_callSpreadDeltaMultipliers[i] < int(ONE_SCALE) ||
				_putSpreadDeltaMultipliers[i] < int(ONE_SCALE)
			) {
				revert InvalidSpreadDeltaMultiplierValue();
			}
		}
		tenorPricingParams[_tenorIndex].callSpreadDeltaMultipliers = _callSpreadDeltaMultipliers;
		tenorPricingParams[_tenorIndex].putSpreadDeltaMultipliers = _putSpreadDeltaMultipliers;
		emit SpreadDeltaMultipliersChanged();
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
			forward,
			false
		);
		vanillaPremium = vanillaPremium.mul(underlyingPrice).div(forward);
		uint256 premium = vanillaPremium.mul(
			_getSlippageMultiplier(_optionSeries, _amount, delta, isSell, netDhvExposure)
		);
		console.log("slippage premium");
		console.log((premium * _amount) / 1e18);
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
		console.log("spread");
		console.logInt(spread);
		// the delta returned is the delta of a long position of the option the sign of delta should be handled elsewhere.

		totalPremium = isSell
			? uint(OptionsCompute.max(int(premium.mul(_amount)) - spread, 0))
			: premium.mul(_amount) + uint(spread);

		totalPremium = OptionsCompute.convertToDecimals(totalPremium, ERC20(collateralAsset).decimals());
		totalDelta = delta.mul(int256(_amount));
		totalFees = feePerContract.mul(_amount);

		if (isSell && uint256(delta.abs()) < lowDeltaThreshold) {
			(uint overridePremium, ) = OptionsCompute.quotePriceGreeks(
				_optionSeries,
				isSell,
				bidAskIVSpread,
				riskFreeRate,
				lowDeltaSellOptionFlatIV,
				forward,
				true // override IV
			);

			overridePremium = OptionsCompute.convertToDecimals(
				overridePremium.mul(_amount),
				ERC20(collateralAsset).decimals()
			);
			totalPremium = OptionsCompute.min(totalPremium, overridePremium);
		}
		console.log("total Premium: ", totalPremium);
	}

	///////////////////////////
	/// non-complex getters ///
	///////////////////////////

	function getCallSlippageGradientMultipliers(
		uint16 _tenorIndex
	) external view returns (uint80[] memory) {
		return tenorPricingParams[_tenorIndex].callSlippageGradientMultipliers;
	}

	function getPutSlippageGradientMultipliers(
		uint16 _tenorIndex
	) external view returns (uint80[] memory) {
		return tenorPricingParams[_tenorIndex].putSlippageGradientMultipliers;
	}

	function getCallSpreadCollateralMultipliers(
		uint16 _tenorIndex
	) external view returns (uint80[] memory) {
		return tenorPricingParams[_tenorIndex].callSpreadCollateralMultipliers;
	}

	function getPutSpreadCollateralMultipliers(
		uint16 _tenorIndex
	) external view returns (uint80[] memory) {
		return tenorPricingParams[_tenorIndex].putSpreadCollateralMultipliers;
	}

	function getCallSpreadDeltaMultipliers(uint16 _tenorIndex) external view returns (int80[] memory) {
		return tenorPricingParams[_tenorIndex].callSpreadDeltaMultipliers;
	}

	function getPutSpreadDeltaMultipliers(uint16 _tenorIndex) external view returns (int80[] memory) {
		return tenorPricingParams[_tenorIndex].putSpreadDeltaMultipliers;
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
		Types.OptionSeries memory _optionSeries,
		uint256 _amount,
		int256 _optionDelta,
		bool _isSell,
		int256 _netDhvExposure
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
		(uint16 tenorIndex, uint256 remainder) = _getTenorIndex(_optionSeries.expiration);
		console.log(tenorIndex, remainder, deltaBandIndex);
		if (_optionDelta < 0) {
			modifiedSlippageGradient = slippageGradient.mul(
				_interpolateSlippageGradient(tenorIndex, remainder, true, deltaBandIndex)
			);
		} else {
			modifiedSlippageGradient = slippageGradient.mul(
				_interpolateSlippageGradient(tenorIndex, remainder, false, deltaBandIndex)
			);
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
		console.log("slippage multiplier", slippageMultiplier);
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
		uint256 deltaBandIndex = (uint256(_optionDelta.abs()) * 100) / deltaBandWidth;
		(uint16 tenorIndex, uint256 remainder) = _getTenorIndex(_optionSeries.expiration);

		if (!_isSell) {
			spreadPremium += int(
				_getCollateralLendingPremium(
					_optionSeries,
					_amount,
					_optionDelta,
					_netDhvExposure,
					time,
					deltaBandIndex,
					tenorIndex,
					remainder
				)
			);
		}

		spreadPremium += _getDeltaBorrowPremium(
			_isSell,
			_amount,
			_optionDelta,
			time,
			deltaBandIndex,
			_underlyingPrice,
			tenorIndex,
			remainder
		);
	}

	function _getCollateralLendingPremium(
		Types.OptionSeries memory _optionSeries,
		uint _amount,
		int256 _optionDelta,
		int256 _netDhvExposure,
		uint256 _time,
		uint256 _deltaBandIndex,
		uint16 _tenorIndex,
		uint256 _remainder
	) internal view returns (uint256 collateralLendingPremium) {
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
			collateralLendingPremium =
				((ONE_SCALE + (collateralLendingRate * ONE_SCALE) / SIX_DPS).pow(_time)).mul(collateralToLend) -
				collateralToLend;
			if (_optionDelta < 0) {
				collateralLendingPremium = collateralLendingPremium.mul(
					_interpolateSpreadCollateral(_tenorIndex, _remainder, true, _deltaBandIndex)
				);
			} else {
				collateralLendingPremium = collateralLendingPremium.mul(
					_interpolateSpreadCollateral(_tenorIndex, _remainder, false, _deltaBandIndex)
				);
			}
		}
		console.log("collat lending premium:", collateralLendingPremium);
	}

	function _getDeltaBorrowPremium(
		bool _isSell,
		uint _amount,
		int256 _optionDelta,
		uint256 _time,
		uint256 _deltaBandIndex,
		uint256 _underlyingPrice,
		uint16 _tenorIndex,
		uint256 _remainder
	) internal view returns (int256 deltaBorrowPremium) {
		// calculate delta borrow premium on both buy and sells
		// dollarDelta is just a magnitude value, sign doesnt matter
		int256 dollarDelta = int256(uint256(_optionDelta.abs()).mul(_amount).mul(_underlyingPrice));
		if (_optionDelta < 0) {
			// option is negative delta, resulting in long delta exposure for DHV. needs hedging with a short pos
			deltaBorrowPremium =
				dollarDelta.mul(
					(ONE_SCALE_INT +
						((_isSell ? deltaBorrowRates.sellLong : deltaBorrowRates.buyShort) * ONE_SCALE_INT) /
						SIX_DPS_INT).pow(int(_time))
				) -
				dollarDelta;

			deltaBorrowPremium = deltaBorrowPremium.mul(
				_interpolateSpreadDelta(_tenorIndex, _remainder, true, _deltaBandIndex)
			);
		} else {
			// option is positive delta, resulting in short delta exposure for DHV. needs hedging with a long pos
			deltaBorrowPremium =
				dollarDelta.mul(
					(ONE_SCALE_INT +
						((_isSell ? deltaBorrowRates.sellShort : deltaBorrowRates.buyLong) * ONE_SCALE_INT) /
						SIX_DPS_INT).pow(int(_time))
				) -
				dollarDelta;

			deltaBorrowPremium = deltaBorrowPremium.mul(
				_interpolateSpreadDelta(_tenorIndex, _remainder, false, _deltaBandIndex)
			);
		}
		console.log("delta borrow premium:", uint(deltaBorrowPremium));
	}

	function _getTenorIndex(
		uint256 _expiration
	) internal view returns (uint16 tenorIndex, uint256 remainder) {
		// get the ratio of the square root of seconds to expiry and the max tenor value in e18 form
		uint unroundedTenorIndex = ((((_expiration - block.timestamp) * 1e18).sqrt()) / maxTenorValue);
		tenorIndex = uint16(unroundedTenorIndex / 1e18); // always floors
		remainder = unroundedTenorIndex - tenorIndex; // will be between 0 and 1e18
	}

	function _interpolateSlippageGradient(
		uint16 _tenor,
		uint256 _remainder,
		bool _isPut,
		uint256 _deltaBand
	) internal view returns (uint80 slippageGradientMultiplier) {
		if (_isPut) {
			uint80 y1 = tenorPricingParams[_tenor].putSlippageGradientMultipliers[_deltaBand];
			uint80 y2 = tenorPricingParams[_tenor + 1].putSlippageGradientMultipliers[_deltaBand];
			return uint80(y1 + _remainder.mul(y2 - y1));
		} else {
			uint80 y1 = tenorPricingParams[_tenor].callSlippageGradientMultipliers[_deltaBand];
			uint80 y2 = tenorPricingParams[_tenor + 1].callSlippageGradientMultipliers[_deltaBand];
			console.log(y1, y2, _remainder, y2 - y1);
			return uint80(y1 + _remainder.mul(y2 - y1));
		}
	}

	function _interpolateSpreadCollateral(
		uint16 _tenor,
		uint256 _remainder,
		bool _isPut,
		uint256 _deltaBand
	) internal view returns (uint80 spreadCollateralMultiplier) {
		if (_isPut) {
			uint80 y1 = tenorPricingParams[_tenor].putSpreadCollateralMultipliers[_deltaBand];
			uint80 y2 = tenorPricingParams[_tenor + 1].putSpreadCollateralMultipliers[_deltaBand];
			console.log("spread collat:", y1, y2, _remainder);
			return uint80(y1 + _remainder.mul(y2 - y1));
		} else {
			uint80 y1 = tenorPricingParams[_tenor].callSpreadCollateralMultipliers[_deltaBand];
			uint80 y2 = tenorPricingParams[_tenor + 1].callSpreadCollateralMultipliers[_deltaBand];
			console.log("spread collat:", y1, y2, _remainder);
			return uint80(y1 + _remainder.mul(y2 - y1));
		}
	}

	function _interpolateSpreadDelta(
		uint16 _tenor,
		uint256 _remainder,
		bool _isPut,
		uint256 _deltaBand
	) internal view returns (int80 spreadDeltaMultiplier) {
		if (_isPut) {
			int80 y1 = tenorPricingParams[_tenor].putSpreadDeltaMultipliers[_deltaBand];
			int80 y2 = tenorPricingParams[_tenor + 1].putSpreadDeltaMultipliers[_deltaBand];
			return int80(y1 + int(_remainder).mul(y2 - y1));
		} else {
			int80 y1 = tenorPricingParams[_tenor].callSpreadDeltaMultipliers[_deltaBand];
			int80 y2 = tenorPricingParams[_tenor + 1].callSpreadDeltaMultipliers[_deltaBand];
			return int80(y1 + int(_remainder).mul(y2 - y1));
		}
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
