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

	uint256 bidAskIVSpread;
	uint256 riskFreeRate;
	uint256 feePerContract = 3e5;

	uint256 public slippageGradient;

	// multiplier of slippageGradient for options < 10 delta
	// reflects the cost of increased collateral used to back these kind of options relative to their price.
	uint256 public lowDeltaSlippageMultiplier;
	// multiplier of slippageGradient for options between 10 and 25 delta
	uint256 public mediumDeltaSlippageMultiplier;
	// multiplier of slippageGradient for options > 25 delta

	uint256 public highDeltaSlippageMultiplier;
	//////////////////////////
	/// constant variables ///
	//////////////////////////

	// BIPS
	uint256 private constant MAX_BPS = 10_000;

	/////////////////////////
	/// structs && events ///
	/////////////////////////

	event FeePerContractChanged(uint256 newFeePerContract, uint256 oldFeePerContract);

	constructor(
		address _authority,
		address _protocol,
		address _liquidityPool,
		uint256 _slippageGradient
	) AccessControl(IAuthority(_authority)) {
		protocol = Protocol(_protocol);
		liquidityPool = ILiquidityPool(_liquidityPool);
		collateralAsset = liquidityPool.collateralAsset();
		underlyingAsset = liquidityPool.underlyingAsset();
		strikeAsset = liquidityPool.strikeAsset();
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

	function setLowDeltaSlippageMultiplier(uint256 _lowDeltaSlippageMultiplier) external {
		_onlyGuardian();
		lowDeltaSlippageMultiplier = _lowDeltaSlippageMultiplier;
	}

	function setMediumDeltaSlippageMultiplier(uint256 _mediumDeltaSlippageMultiplier) external {
		_onlyGuardian();
		mediumDeltaSlippageMultiplier = _mediumDeltaSlippageMultiplier;
	}

	function setHighDeltaSlippageMultiplier(uint256 _highDeltaSlippageMultiplier) external {
		_onlyGuardian();
		highDeltaSlippageMultiplier = _highDeltaSlippageMultiplier;
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
			_getSlippageMultiplier(_optionSeries, _amount, isSell, vanillaPremium, delta, netDhvExposure)
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

	function _getSlippageMultiplier(
		Types.OptionSeries memory _optionSeries,
		uint256 _amount,
		bool isSell,
		uint256 vanillaPremium,
		int256 optionDelta,
		int256 netDhvExposure
	) internal view returns (uint256 slippageMultiplier) {
		// divide _amount by 2 to obtain the average exposure throughout the tx. Stops large orders being disproportionately penalised.
		console.log("exposure", uint256(netDhvExposure), _amount);
		int256 exposureCoefficient = netDhvExposure + int256(_amount) / 2;
		if (exposureCoefficient < 0) {
			return 1e18;
		}
		uint256 modifiedSlippageGradient;
		if (optionDelta.abs() < 10e18) {
			// these options require most collateral per dollar of premium
			modifiedSlippageGradient = slippageGradient.mul(lowDeltaSlippageMultiplier);
		} else if (10e18 <= optionDelta.abs() && optionDelta.abs() < 25e18) {
			modifiedSlippageGradient = slippageGradient.mul(mediumDeltaSlippageMultiplier);
		} else if (optionDelta.abs() >= 25e18) {
			modifiedSlippageGradient = slippageGradient.mul(highDeltaSlippageMultiplier);
		}
		// multiply the gradient by the number of contracts the dhv will have exposure to by the end of the tx
		uint256 slippagePremium = (modifiedSlippageGradient).mul(uint256(exposureCoefficient));
		console.log(
			"multiplier:",
			1e18 + slippagePremium,
			slippageGradient,
			uint256(exposureCoefficient)
		);

		return 1e18 + slippagePremium;
	}
}
