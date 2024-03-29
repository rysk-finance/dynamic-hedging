pragma solidity 0.8.10;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../../contracts/libraries/Types.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";

contract SpreadTest is Test {
	using Strings for uint256;
	using Strings for int256;
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
		int80[5] callSlippageGradientMultipliers;
		int80[5] putSlippageGradientMultipliers;
		// array of collateral lending spread multipliers for each delta band. e18
		int80[5] callSpreadCollateralMultipliers;
		int80[5] putSpreadCollateralMultipliers;
		// array of delta borrow spread multipliers for each delta band. e18
		int80[5] callSpreadDeltaMultipliers;
		int80[5] putSpreadDeltaMultipliers;
	}
	// represents the number of tenors for which we want to apply separate slippage and spread parameters to
	uint256 public numberOfTenors;
	// multiplier values for spread and slippage delta bands
	DeltaBandMultipliers[] internal tenorPricingParams;
	// maximum tenor value. Units are in sqrt(seconds)
	uint16 public maxTenorValue;
	uint256 deltaBandWidth;
	uint256 public collateralLendingRate;
	//  delta borrow rates for spread func. All denominated in 6 dps
	DeltaBorrowRates public deltaBorrowRates;
	uint256 public collateralRequirements;
	uint64 public expirationLength;
	Types.OptionSeries public optionSeries =
		Types.OptionSeries(
			uint64(block.timestamp) + 2419200,
			2000e18,
			false,
			0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,
			0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,
			0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
		);
	// asset that is used for collateral asset
	address public collateralAsset = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
	uint256 private constant SIX_DPS = 1_000_000;
	uint256 private constant ONE_YEAR_SECONDS = 31557600;
	// used to convert e18 to e8
	uint256 private constant SCALE_FROM = 10 ** 10;
	uint256 private constant ONE_DELTA = 100e18;
	uint256 private constant ONE_SCALE = 1e18;
	int256 private constant ONE_SCALE_INT = 1e18;
	int256 private constant SIX_DPS_INT = 1_000_000;

	function setUp() public {
		collateralLendingRate = 1000; // 10%
		deltaBorrowRates = DeltaBorrowRates(1500, 1000, 1000, 1500);
		collateralRequirements = 1000e18;
		expirationLength = 2419200; // 4 weeks
		DeltaBandMultipliers[3] memory _tenorPricingParams = [
		DeltaBandMultipliers([
			int80(1e18),
			1.1e18,
			1.2e18,
			1.3e18,
			1.4e18
		], [
			int80(1.1e18),
			1.2e18,
			1.3e18,
			1.4e18,
			1.5e18
		], [
			int80(1e18),
			1.1e18,
			1.2e18,
			1.3e18,
			1.4e18
		], [
			int80(1.1e18),
			1.2e18,
			1.3e18,
			1.4e18,
			1.5e18
		],
		 [
			int80(1e18),
			1.1e18,
			1.2e18,
			1.3e18,
			1.4e18
		], [
			int80(1.1e18),
			1.2e18,
			1.3e18,
			1.4e18,
			1.5e18
		]),
		DeltaBandMultipliers([
			int80(2e18),
			2.1e18,
			2.2e18,
			2.3e18,
			2.4e18
		], [
			int80(2.1e18),
			2.2e18,
			2.3e18,
			2.4e18,
			2.5e18
		], [
			int80(2e18),
			2.1e18,
			2.2e18,
			2.3e18,
			2.4e18
		], [
			int80(2.1e18),
			2.2e18,
			2.3e18,
			2.4e18,
			2.5e18
		], [
			int80(2e18),
			2.1e18,
			2.2e18,
			2.3e18,
			2.4e18
		], [
			int80(2.1e18),
			2.2e18,
			2.3e18,
			2.4e18,
			2.5e18
		]),
		DeltaBandMultipliers([
			int80(1e18),
			1.1e18,
			1.2e18,
			1.3e18,
			1.4e18
		], [
			int80(1.1e18),
			1.2e18,
			1.3e18,
			1.4e18,
			1.5e18
		], [
			int80(1e18),
			1.1e18,
			1.2e18,
			1.3e18,
			1.4e18
		], [
			int80(1.1e18),
			1.2e18,
			1.3e18,
			1.4e18,
			1.5e18
		], [
			int80(1e18),
			1.1e18,
			1.2e18,
			1.3e18,
			1.4e18
		], [
			int80(1.1e18),
			1.2e18,
			1.3e18,
			1.4e18,
			1.5e18
		])
		];
		for (uint i; i < _tenorPricingParams.length; i++) {
			tenorPricingParams.push(_tenorPricingParams[i]);
		}
		deltaBandWidth = 20e18;
		maxTenorValue = 2800;
		numberOfTenors = 3;
	}

	function testSpreadValueFuzzLongDeltaBorrowRate(uint16 _longDeltaBorrowRate) public {
		vm.assume(_longDeltaBorrowRate >= 0);
		vm.assume(_longDeltaBorrowRate <= 10000);
		deltaBorrowRates.sellLong = int256(uint256(_longDeltaBorrowRate));
		deltaBorrowRates.buyLong = int256(uint256(_longDeltaBorrowRate));

		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -1000e18, 500e18);
	}

	function testSpreadValueFuzzShortDeltaBorrowRate(uint16 _shortDeltaBorrowRate) public {
		vm.assume(_shortDeltaBorrowRate >= 0);
		vm.assume(_shortDeltaBorrowRate <= 10000);
		deltaBorrowRates.sellShort = int256(uint256(_shortDeltaBorrowRate));
		deltaBorrowRates.buyShort = int256(uint256(_shortDeltaBorrowRate));

		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -1000e18, 500e18);
	}

	function testSpreadValueFuzzCollateralLendingRate(uint16 _collateralLendingRate) public {
		vm.assume(_collateralLendingRate >= 0);
		vm.assume(_collateralLendingRate <= 10000);
		collateralLendingRate = _collateralLendingRate;

		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -1000e18, 500e18);
	}

	function testSpreadValueFuzzCollateralRequirements(uint96 _collateralRequirements) public {
		vm.assume(_collateralRequirements >= 0);
		vm.assume(_collateralRequirements <= 1e28);
		collateralRequirements = _collateralRequirements;

		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -99e16, -1000e18, 500e18);
	}

	function testSpreadValueFuzzTimestamp(uint32 _expirationTimestamp) public {
		vm.assume(_expirationTimestamp > block.timestamp);
		vm.assume(_expirationTimestamp < block.timestamp + 7.776e6);
		Types.OptionSeries memory _optionSeries = optionSeries;
		_optionSeries.expiration = _expirationTimestamp;
		_getSpreadValue(true, _optionSeries, 1000e18, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 5e17, 0, 2000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 5e17, 0, 1000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -5e17, 0, 2000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -5e17, 0, 1000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -1e16, 0, 2000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -1e16, 0, 1000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 99e16, 100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 99e16, 100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 99e16, -100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 99e16, -100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 99e16, 0, 2000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 99e16, 0, 1000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 99e16, -1000e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 99e16, -1000e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 5e17, 0, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 5e17, 0, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -5e17, 0, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -5e17, 0, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -1e16, 0, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -1e16, 0, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 99e16, 100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 99e16, 100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 99e16, -100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 99e16, -100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 99e16, 0, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 99e16, 0, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 99e16, -1000e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 99e16, -1000e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 5e17, 0, 2000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 5e17, 0, 1000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -5e17, 0, 2000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -5e17, 0, 1000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -1e16, 0, 2000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -1e16, 0, 1000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 99e16, 100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 99e16, 100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 99e16, -100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 99e16, -100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 99e16, 0, 2000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 99e16, 0, 1000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 99e16, -1000e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 99e16, -1000e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e18, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e18, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e18, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e18, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e18, 5e17, 0, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e18, 5e17, 0, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e18, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e18, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -5e17, 0, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -5e17, 0, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -1e16, 0, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -1e16, 0, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -99e16, 100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -99e16, 100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -99e16, -100e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -99e16, -100e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -99e16, 0, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -99e16, 0, 1000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -99e16, -1000e18, 2000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -99e16, -1000e18, 1000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 5e17, 100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 5e17, -100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 5e17, 0, 10000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 5e17, 0, 500e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -5e17, 100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -5e17, -100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -5e17, 0, 10000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -5e17, 0, 500e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -1e16, 100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -1e16, -100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -1e16, 0, 10000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -1e16, 0, 500e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 99e16, 100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 99e16, 100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 99e16, -100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 99e16, -100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 99e16, 0, 10000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 99e16, 0, 500e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 99e16, -1000e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1000e18, 99e16, -1000e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e16, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 5e17, 100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e16, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 5e17, -100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e16, 5e17, 0, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 5e17, 0, 500e18);
		_getSpreadValue(true, _optionSeries, 1e16, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e16, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -5e17, 100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e16, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -5e17, -100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e16, -5e17, 0, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -5e17, 0, 500e18);
		_getSpreadValue(true, _optionSeries, 1e16, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e16, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -1e16, 100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e16, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -1e16, -100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e16, -1e16, 0, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -1e16, 0, 500e18);
		_getSpreadValue(true, _optionSeries, 1e16, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e16, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e16, 99e16, 100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 99e16, 100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e16, 99e16, -100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 99e16, -100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e16, 99e16, 0, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 99e16, 0, 500e18);
		_getSpreadValue(true, _optionSeries, 1e16, 99e16, -1000e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e16, 99e16, -1000e18, 500e18);
		_getSpreadValue(true, _optionSeries, 50e18, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 5e17, 100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 50e18, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 5e17, -100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 50e18, 5e17, 0, 10000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 5e17, 0, 500e18);
		_getSpreadValue(true, _optionSeries, 50e18, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, _optionSeries, 50e18, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -5e17, 100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 50e18, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -5e17, -100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 50e18, -5e17, 0, 10000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -5e17, 0, 500e18);
		_getSpreadValue(true, _optionSeries, 50e18, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, _optionSeries, 50e18, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -1e16, 100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 50e18, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -1e16, -100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 50e18, -1e16, 0, 10000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -1e16, 0, 500e18);
		_getSpreadValue(true, _optionSeries, 50e18, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 50e18, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, _optionSeries, 50e18, 99e16, 100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 99e16, 100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 50e18, 99e16, -100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 99e16, -100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 50e18, 99e16, 0, 10000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 99e16, 0, 500e18);
		_getSpreadValue(true, _optionSeries, 50e18, 99e16, -1000e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 50e18, 99e16, -1000e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e18, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e18, 5e17, 100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e18, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e18, 5e17, -100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e18, 5e17, 0, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e18, 5e17, 0, 500e18);
		_getSpreadValue(true, _optionSeries, 1e18, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e18, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e18, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -5e17, 100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e18, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -5e17, -100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e18, -5e17, 0, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -5e17, 0, 500e18);
		_getSpreadValue(true, _optionSeries, 1e18, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e18, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -1e16, 100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e18, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -1e16, -100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e18, -1e16, 0, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -1e16, 0, 500e18);
		_getSpreadValue(true, _optionSeries, 1e18, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e18, -99e16, 100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -99e16, 100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e18, -99e16, -100e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -99e16, -100e18, 500e18);
		_getSpreadValue(true, _optionSeries, 1e18, -99e16, 0, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -99e16, 0, 500e18);
		_getSpreadValue(true, _optionSeries, 1e18, -99e16, -1000e18, 10000e18);
		_getSpreadValue(true, _optionSeries, 1e18, -99e16, -1000e18, 500e18);
	}

	function testSpreadValueFuzzAmount(uint80 _amount) public {
		vm.assume(_amount > 1e16);
		vm.assume(_amount < 1000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, 0, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, 0, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, 0, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, 0, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, 5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, 0, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, 0, 500e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, -5e17, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, -1e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, 0, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, 0, 500e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, _amount, 99e16, -1000e18, 500e18);
	}

	function testSpreadValueFuzzDelta(int64 _delta) public {
		vm.assume(_delta <= 1e18);
		vm.assume(_delta >= -1e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, 100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, 100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, -100e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, -100e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, 0, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, 0, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, -1000e18, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, -1000e18, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, 100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, 100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, -100e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, -100e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, _delta, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, _delta, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, 0, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, 0, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, _delta, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, -1000e18, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, 0, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, 0, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, -1000e18, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, _delta, -1000e18, 500e18);
	}

	function testSpreadValueFuzzNetDhvExposure(int96 _netDhvExposure) public {
		vm.assume(_netDhvExposure <= 50000e18);
		vm.assume(_netDhvExposure >= -50000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 99e16, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 99e16, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1e18, 99e16, _netDhvExposure, 2000e18);
		_getSpreadValue(true, optionSeries, 1e18, 99e16, _netDhvExposure, 1000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 99e16, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 99e16, _netDhvExposure, 500e18);
		_getSpreadValue(true, optionSeries, 1e18, 99e16, _netDhvExposure, 10000e18);
		_getSpreadValue(true, optionSeries, 1e18, 99e16, _netDhvExposure, 500e18);
	}

	function testSpreadValueFuzzUnderlyingPrice(uint80 _underlyingPrice) public {
		vm.assume(_underlyingPrice <= 50000e18);
		vm.assume(_underlyingPrice >= 50e18);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, 99e16, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, 99e16, 100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, 99e16, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, 99e16, -100e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, 5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, -5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, 5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, -5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, 5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, -5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, 5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, -5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, -1e16, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1000e18, 99e16, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, -1e16, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e16, 99e16, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, -1e16, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 50e18, 99e16, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, -1e16, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, 99e16, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, 99e16, 0, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, 99e16, -1000e18, _underlyingPrice);
		_getSpreadValue(true, optionSeries, 1e18, 99e16, -1000e18, _underlyingPrice);
	}

	function testSpreadFFIGetSpread() public {
		uint256 amount = 10e18;
		int256 delta = 5e17;
		int256 netDhvExposure = -1000e18;
		uint256 underlyingPrice = 1800e18;
		uint256 solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, delta, netDhvExposure, underlyingPrice));
		uint256 pySpreadMul = getSpreadValue(true, optionSeries, amount, delta, netDhvExposure, underlyingPrice);
		assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, delta, netDhvExposure, underlyingPrice));
		pySpreadMul = getSpreadValue(false, optionSeries, amount, delta, netDhvExposure, underlyingPrice);
		assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, -delta, netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(true, optionSeries, amount, -delta, netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, -delta, netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(false, optionSeries, amount, -delta, netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(true, optionSeries, amount, delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(false, optionSeries, amount, delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(true, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(false, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
	}

	function testSpreadFFIFuzzDeltaGetSpread(int64 delta) public {
		vm.assume(delta <= 1e18);
		vm.assume(delta >= -1e18);
		uint256 amount = 100e18;
		int256 netDhvExposure = -1000e18;
		uint256 underlyingPrice = 1800e18;
		uint256 solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, delta, netDhvExposure, underlyingPrice));
		uint256 pySpreadMul = getSpreadValue(true, optionSeries, amount, delta, netDhvExposure, underlyingPrice);
		assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, delta, netDhvExposure, underlyingPrice));
		pySpreadMul = getSpreadValue(false, optionSeries, amount, delta, netDhvExposure, underlyingPrice);
		assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, -delta, netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(true, optionSeries, amount, -delta, netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, -delta, netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(false, optionSeries, amount, -delta, netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(true, optionSeries, amount, delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(false, optionSeries, amount, delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(true, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(false, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
	}
	
	function testSpreadFFIFuzzAmountGetSpread(uint128 amount) public {
		vm.assume(amount > 1e16);
		vm.assume(amount < 1000e18);
		int256 delta = 5e17;
		int256 netDhvExposure = -1000e18;
		uint256 underlyingPrice = 1800e18;
		uint256 solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, delta, netDhvExposure, underlyingPrice));
		uint256 pySpreadMul = getSpreadValue(true, optionSeries, amount, delta, netDhvExposure, underlyingPrice);
		assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, delta, netDhvExposure, underlyingPrice));
		pySpreadMul = getSpreadValue(false, optionSeries, amount, delta, netDhvExposure, underlyingPrice);
		assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, -delta, netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(true, optionSeries, amount, -delta, netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, -delta, netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(false, optionSeries, amount, -delta, netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(true, optionSeries, amount, delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(false, optionSeries, amount, delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(true, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(false, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
	}

	function testSpreadFFIFuzzNetDhvExposureGetSpread(int96 netDhvExposure) public {
		vm.assume(netDhvExposure <= 50000e18);
		vm.assume(netDhvExposure >= -50000e18);
		uint256 amount = 1000e18;
		int256 delta = 5e17;
		uint256 underlyingPrice = 1800e18;
		uint256 solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, delta, netDhvExposure, underlyingPrice));
		uint256 pySpreadMul = getSpreadValue(true, optionSeries, amount, delta, netDhvExposure, underlyingPrice);
		assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, delta, netDhvExposure, underlyingPrice));
		pySpreadMul = getSpreadValue(false, optionSeries, amount, delta, netDhvExposure, underlyingPrice);
		assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, -delta, netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(true, optionSeries, amount, -delta, netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, -delta, netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(false, optionSeries, amount, -delta, netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(true, optionSeries, amount, delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(false, optionSeries, amount, delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(true, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(false, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
	}

	function testSpreadFFIFuzzUnderlyingPriceGetSpread(uint96 underlyingPrice) public {
		vm.assume(underlyingPrice > 0e18);
		vm.assume(underlyingPrice < 30000e18);
		uint256 amount = 1000e18;
		int256 delta = 5e17;
		int256 netDhvExposure = -1000e18;
		uint256 solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, delta, netDhvExposure, underlyingPrice));
		uint256 pySpreadMul = getSpreadValue(true, optionSeries, amount, delta, netDhvExposure, underlyingPrice);
		assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e8);
		solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, delta, netDhvExposure, underlyingPrice));
		pySpreadMul = getSpreadValue(false, optionSeries, amount, delta, netDhvExposure, underlyingPrice);
		assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e8);
		// solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, -delta, netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(true, optionSeries, amount, -delta, netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, -delta, netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(false, optionSeries, amount, -delta, netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(true, optionSeries, amount, delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(false, optionSeries, amount, delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(true, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(true, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
		// solSpreadMul = uint256(_getSpreadValue(false, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice));
		// pySpreadMul = getSpreadValue(false, optionSeries, amount, -delta, -netDhvExposure, underlyingPrice);
		// assertApproxEqAbs(solSpreadMul, pySpreadMul, 1e7);
	}

	function getSpreadValue(
		bool _isSellBool,
		Types.OptionSeries memory _optionSeries,
		uint256 _amount,
		int256 _delta,
		int256 _netDhvExposure,
		uint256 _underlyingPrice
	) private returns (uint256) {
		uint256 time = (_optionSeries.expiration - block.timestamp).div(ONE_YEAR_SECONDS);
		uint256 isNetDhvExposureNegative;
		uint256 isDeltaNegative;
		uint256 isSell;
		if (_netDhvExposure < 0) {
			isNetDhvExposureNegative = 1;
			_netDhvExposure = -_netDhvExposure;
		}
		if (_delta < 0) {
			isDeltaNegative = 1;
			_delta = -_delta;
		}
		if (_isSellBool) {
			isSell = 1;
		}
		string[] memory inputs = new string[](34);
		inputs[0] = "python3";
		inputs[1] = "test/foundry/spread.py";
		inputs[2] = "--amount";
		inputs[3] = uint256(_amount).toString();
		inputs[4] = "--netDhvExposure";
		inputs[5] = uint256(_netDhvExposure).toString();
		inputs[6] = "--isNetDhvExposureNegative";
		inputs[7] = uint256(isNetDhvExposureNegative).toString();
		inputs[8] = "--isSell";
		inputs[9] = uint256(isSell).toString();
		inputs[10] = "--delta";
		inputs[11] = uint256(_delta).toString();
		inputs[12] = "--isDeltaNegative";
		inputs[13] = uint256(isDeltaNegative).toString();
		inputs[14] = "--marginRequirementPerContract";
		inputs[15] = uint256(collateralRequirements).toString();
		inputs[16] = "--collatLendingRate";
		inputs[17] = uint256(collateralLendingRate).toString();
		inputs[18] = "--sellLongRate";
		inputs[19] = uint256(deltaBorrowRates.sellLong).toString();
		inputs[20] = "--sellShortRate";
		inputs[21] = uint256(deltaBorrowRates.sellShort).toString();
		inputs[22] = "--buyLongRate";
		inputs[23] = uint256(deltaBorrowRates.buyLong).toString();
		inputs[24] = "--buyShortRate";
		inputs[25] = uint256(deltaBorrowRates.buyShort).toString();
		inputs[26] = "--underlyingPrice";
		inputs[27] = uint256(_underlyingPrice).toString();
		inputs[28] = "--time";
		inputs[29] = uint256(time).toString();
		inputs[30] = "--expiration";
		inputs[31] = uint256(optionSeries.expiration).toString();
		inputs[32] = "--timestamp";
		inputs[33] = uint256(block.timestamp).toString();
		bytes memory res = vm.ffi(inputs);
		uint256 vol = abi.decode(res, (uint256));
		return vol;
	}

	// FUNCTION TO BE FUZZED

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
		(uint16 tenorIndex, int256 remainder) = _getTenorIndex(_optionSeries.expiration);

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
		int256 _remainder
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
	}


	function _getDeltaBorrowPremium(
		bool _isSell,
		uint _amount,
		int256 _optionDelta,
		uint256 _time,
		uint256 _deltaBandIndex,
		uint256 _underlyingPrice,
		uint16 _tenorIndex,
		int256 _remainder
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
	}

	function _getTenorIndex(
		uint256 _expiration
	) internal view returns (uint16 tenorIndex, int256 remainder) {
		// get the ratio of the square root of seconds to expiry and the max tenor value in e18 form
		uint unroundedTenorIndex = (((((_expiration - block.timestamp) * 1e18).sqrt()) *
			(numberOfTenors - 1)) / maxTenorValue);
		tenorIndex = uint16(unroundedTenorIndex / 1e18); // always floors
		remainder = int256(unroundedTenorIndex - tenorIndex * 1e18); // will be between 0 and 1e18
	}

	function _interpolateSpreadCollateral(
		uint16 _tenor,
		int256 _remainder,
		bool _isPut,
		uint256 _deltaBand
	) internal view returns (uint80 spreadCollateralMultiplier) {
		if (_isPut) {
			int80 y1 = tenorPricingParams[_tenor].putSpreadCollateralMultipliers[_deltaBand];
			int80 y2 = tenorPricingParams[_tenor + 1].putSpreadCollateralMultipliers[_deltaBand];
			return uint80(int80(y1 + _remainder.mul(y2 - y1)));
		} else {
			int80 y1 = tenorPricingParams[_tenor].callSpreadCollateralMultipliers[_deltaBand];
			int80 y2 = tenorPricingParams[_tenor + 1].callSpreadCollateralMultipliers[_deltaBand];
			return uint80(int80(y1 + _remainder.mul(y2 - y1)));
		}
	}

	function _interpolateSpreadDelta(
		uint16 _tenor,
		int256 _remainder,
		bool _isPut,
		uint256 _deltaBand
	) internal view returns (int80 spreadDeltaMultiplier) {
		if (_isPut) {
			int80 y1 = tenorPricingParams[_tenor].putSpreadDeltaMultipliers[_deltaBand];
			int80 y2 = tenorPricingParams[_tenor + 1].putSpreadDeltaMultipliers[_deltaBand];
			return int80(y1 + _remainder.mul(y2 - y1));
		} else {
			int80 y1 = tenorPricingParams[_tenor].callSpreadDeltaMultipliers[_deltaBand];
			int80 y2 = tenorPricingParams[_tenor + 1].callSpreadDeltaMultipliers[_deltaBand];
			return int80(y1 + _remainder.mul(y2 - y1));
		}
	}

	function _getCollateralRequirements(Types.OptionSeries memory _optionSeries, uint256 netShortContracts) internal view returns (uint256) {
		return collateralRequirements.mul(netShortContracts);
	}
}
