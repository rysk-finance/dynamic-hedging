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

import "./interfaces/ILiquidityPool.sol";
import "./interfaces/IOptionRegistry.sol";
import "./interfaces/IPortfolioValuesFeed.sol";

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

	//////////////////////////
	/// constant variables ///
	//////////////////////////

	// BIPS
	uint256 private constant MAX_BPS = 10_000;

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
		uint256 _slippageGradient,
		uint256 _deltaBandWidth,
		uint256[] memory _callSlippageGradientMultipliers,
		uint256[] memory _putSlippageGradientMultipliers
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
		collateralAsset = liquidityPool.collateralAsset();
		underlyingAsset = liquidityPool.underlyingAsset();
		strikeAsset = liquidityPool.strikeAsset();
		slippageGradient = _slippageGradient;
		deltaBandWidth = _deltaBandWidth;
		callSlippageGradientMultipliers = _callSlippageGradientMultipliers;
		putSlippageGradientMultipliers = _putSlippageGradientMultipliers;
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
		console.log("amount", _amount);
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
			_getSlippageMultiplier(_optionSeries, _amount, delta, netDhvExposure, isSell)
		);

		totalPremium = premium.mul(_amount) / 1e12;
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
	 * @param _optionSeries the option series that we are pricing
	 * @param _amount amount of options contracts being traded. e18
	 * @param _optionDelta the delta exposure of the option
	 * @param _netDhvExposure how many contracts of this series the DHV is already exposed to. e18. negative if net short.
	 * @param _isSell true if someone is selling option to DHV. False if they're buying from DHV
	 */
	function _getSlippageMultiplier(
		Types.OptionSeries memory _optionSeries,
		uint256 _amount,
		int256 _optionDelta,
		int256 _netDhvExposure,
		bool _isSell
	) internal view returns (uint256 slippageMultiplier) {
		// divide _amount by 2 to obtain the average exposure throughout the tx. Stops large orders being disproportionately penalised.
		console.log("exposure", uint256(-_netDhvExposure), _amount);
		// slippage will be exponential with the exponent being the DHV's net exposure
		int256 exposureExponent = _isSell
			? _netDhvExposure + int256(_amount) / 2
			: _netDhvExposure - int256(_amount) / 2;
		uint256 modifiedSlippageGradient;
		// not using math library here, want to reduce to a non e18 integer
		// integer division rounds down to nearest integer
		uint256 deltaBandIndex = (uint256(_optionDelta.abs()) * 100) / deltaBandWidth;
		console.log("delta band index:", deltaBandIndex, uint256(_optionDelta.abs()), deltaBandWidth);
		if (_optionDelta > 0) {
			modifiedSlippageGradient = slippageGradient.mul(callSlippageGradientMultipliers[deltaBandIndex]);
		} else {
			modifiedSlippageGradient = slippageGradient.mul(putSlippageGradientMultipliers[deltaBandIndex]);
		}
		// raise slippageGradient to the power of _amount
		uint256 slippagePremium = uint256(
			(int256(1e18 + modifiedSlippageGradient)).pow(-exposureExponent)
		);
		console.log("multiplier:", slippagePremium, modifiedSlippageGradient, uint256(-exposureExponent));

		return slippagePremium;
	}
}
