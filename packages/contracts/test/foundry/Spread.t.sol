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

	uint256 public collateralLendingRate;
	uint256 public longDeltaBorrowRate;
	uint256 public shortDeltaBorrowRate;
	uint256 public collateralRequirements;
	uint256 public underlyingPrice;
	uint64 public expirationLength;
	Types.OptionSeries public optionSeries =
		Types.OptionSeries(
			uint64(block.timestamp) + expirationLength,
			2000e18,
			false,
			0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,
			0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,
			0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
		);

	uint256 private constant MAX_BPS = 10_000;
	uint256 private constant ONE_YEAR_SECONDS = 31557600;
	uint256 private constant SCALE_FROM = 10**10;

	function setUp() public {
		collateralLendingRate = 1000; // 10%
		longDeltaBorrowRate = 1500; // 15%
		shortDeltaBorrowRate = 1000; // 10%
		collateralRequirements = 10000e18;
		expirationLength = 2419200; // 4 weeks
	}

	function testSpreadValueFuzzTimestamp(uint32 _expirationTimestamp) public {
		vm.assume(_expirationTimestamp > block.timestamp);
		vm.assume(_expirationTimestamp < block.timestamp + ONE_YEAR_SECONDS);
		Types.OptionSeries memory _optionSeries = optionSeries;
		_optionSeries.expiration = _expirationTimestamp;
		_getSpreadValue(_optionSeries, 1000e18, 5e17, 100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1000e18, 5e17, 100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1000e18, 5e17, -100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1000e18, 5e17, -100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1000e18, 5e17, 0, 2000e18);
		_getSpreadValue(_optionSeries, 1000e18, 5e17, 0, 1000e18);
		_getSpreadValue(_optionSeries, 1000e18, 5e17, -1000e18, 2000e18);
		_getSpreadValue(_optionSeries, 1000e18, 5e17, -1000e18, 1000e18);
		_getSpreadValue(_optionSeries, 1000e18, -5e17, 100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1000e18, -5e17, 100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1000e18, -5e17, -100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1000e18, -5e17, -100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1000e18, -5e17, 0, 2000e18);
		_getSpreadValue(_optionSeries, 1000e18, -5e17, 0, 1000e18);
		_getSpreadValue(_optionSeries, 1000e18, -5e17, -1000e18, 2000e18);
		_getSpreadValue(_optionSeries, 1000e18, -5e17, -1000e18, 1000e18);
		_getSpreadValue(_optionSeries, 1000e18, -1e16, 100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1000e18, -1e16, 100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1000e18, -1e16, -100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1000e18, -1e16, -100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1000e18, -1e16, 0, 2000e18);
		_getSpreadValue(_optionSeries, 1000e18, -1e16, 0, 1000e18);
		_getSpreadValue(_optionSeries, 1000e18, -1e16, -1000e18, 2000e18);
		_getSpreadValue(_optionSeries, 1000e18, -1e16, -1000e18, 1000e18);
		_getSpreadValue(_optionSeries, 1000e18, 99e16, 100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1000e18, 99e16, 100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1000e18, 99e16, -100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1000e18, 99e16, -100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1000e18, 99e16, 0, 2000e18);
		_getSpreadValue(_optionSeries, 1000e18, 99e16, 0, 1000e18);
		_getSpreadValue(_optionSeries, 1000e18, 99e16, -1000e18, 2000e18);
		_getSpreadValue(_optionSeries, 1000e18, 99e16, -1000e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e16, 5e17, 100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e16, 5e17, 100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e16, 5e17, -100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e16, 5e17, -100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e16, 5e17, 0, 2000e18);
		_getSpreadValue(_optionSeries, 1e16, 5e17, 0, 1000e18);
		_getSpreadValue(_optionSeries, 1e16, 5e17, -1000e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e16, 5e17, -1000e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e16, -5e17, 100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e16, -5e17, 100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e16, -5e17, -100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e16, -5e17, -100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e16, -5e17, 0, 2000e18);
		_getSpreadValue(_optionSeries, 1e16, -5e17, 0, 1000e18);
		_getSpreadValue(_optionSeries, 1e16, -5e17, -1000e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e16, -5e17, -1000e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e16, -1e16, 100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e16, -1e16, 100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e16, -1e16, -100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e16, -1e16, -100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e16, -1e16, 0, 2000e18);
		_getSpreadValue(_optionSeries, 1e16, -1e16, 0, 1000e18);
		_getSpreadValue(_optionSeries, 1e16, -1e16, -1000e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e16, -1e16, -1000e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e16, 99e16, 100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e16, 99e16, 100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e16, 99e16, -100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e16, 99e16, -100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e16, 99e16, 0, 2000e18);
		_getSpreadValue(_optionSeries, 1e16, 99e16, 0, 1000e18);
		_getSpreadValue(_optionSeries, 1e16, 99e16, -1000e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e16, 99e16, -1000e18, 1000e18);
		_getSpreadValue(_optionSeries, 50e18, 5e17, 100e18, 2000e18);
		_getSpreadValue(_optionSeries, 50e18, 5e17, 100e18, 1000e18);
		_getSpreadValue(_optionSeries, 50e18, 5e17, -100e18, 2000e18);
		_getSpreadValue(_optionSeries, 50e18, 5e17, -100e18, 1000e18);
		_getSpreadValue(_optionSeries, 50e18, 5e17, 0, 2000e18);
		_getSpreadValue(_optionSeries, 50e18, 5e17, 0, 1000e18);
		_getSpreadValue(_optionSeries, 50e18, 5e17, -1000e18, 2000e18);
		_getSpreadValue(_optionSeries, 50e18, 5e17, -1000e18, 1000e18);
		_getSpreadValue(_optionSeries, 50e18, -5e17, 100e18, 2000e18);
		_getSpreadValue(_optionSeries, 50e18, -5e17, 100e18, 1000e18);
		_getSpreadValue(_optionSeries, 50e18, -5e17, -100e18, 2000e18);
		_getSpreadValue(_optionSeries, 50e18, -5e17, -100e18, 1000e18);
		_getSpreadValue(_optionSeries, 50e18, -5e17, 0, 2000e18);
		_getSpreadValue(_optionSeries, 50e18, -5e17, 0, 1000e18);
		_getSpreadValue(_optionSeries, 50e18, -5e17, -1000e18, 2000e18);
		_getSpreadValue(_optionSeries, 50e18, -5e17, -1000e18, 1000e18);
		_getSpreadValue(_optionSeries, 50e18, -1e16, 100e18, 2000e18);
		_getSpreadValue(_optionSeries, 50e18, -1e16, 100e18, 1000e18);
		_getSpreadValue(_optionSeries, 50e18, -1e16, -100e18, 2000e18);
		_getSpreadValue(_optionSeries, 50e18, -1e16, -100e18, 1000e18);
		_getSpreadValue(_optionSeries, 50e18, -1e16, 0, 2000e18);
		_getSpreadValue(_optionSeries, 50e18, -1e16, 0, 1000e18);
		_getSpreadValue(_optionSeries, 50e18, -1e16, -1000e18, 2000e18);
		_getSpreadValue(_optionSeries, 50e18, -1e16, -1000e18, 1000e18);
		_getSpreadValue(_optionSeries, 50e18, 99e16, 100e18, 2000e18);
		_getSpreadValue(_optionSeries, 50e18, 99e16, 100e18, 1000e18);
		_getSpreadValue(_optionSeries, 50e18, 99e16, -100e18, 2000e18);
		_getSpreadValue(_optionSeries, 50e18, 99e16, -100e18, 1000e18);
		_getSpreadValue(_optionSeries, 50e18, 99e16, 0, 2000e18);
		_getSpreadValue(_optionSeries, 50e18, 99e16, 0, 1000e18);
		_getSpreadValue(_optionSeries, 50e18, 99e16, -1000e18, 2000e18);
		_getSpreadValue(_optionSeries, 50e18, 99e16, -1000e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e18, 5e17, 100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e18, 5e17, 100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e18, 5e17, -100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e18, 5e17, -100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e18, 5e17, 0, 2000e18);
		_getSpreadValue(_optionSeries, 1e18, 5e17, 0, 1000e18);
		_getSpreadValue(_optionSeries, 1e18, 5e17, -1000e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e18, 5e17, -1000e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e18, -5e17, 100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e18, -5e17, 100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e18, -5e17, -100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e18, -5e17, -100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e18, -5e17, 0, 2000e18);
		_getSpreadValue(_optionSeries, 1e18, -5e17, 0, 1000e18);
		_getSpreadValue(_optionSeries, 1e18, -5e17, -1000e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e18, -5e17, -1000e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e18, -1e16, 100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e18, -1e16, 100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e18, -1e16, -100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e18, -1e16, -100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e18, -1e16, 0, 2000e18);
		_getSpreadValue(_optionSeries, 1e18, -1e16, 0, 1000e18);
		_getSpreadValue(_optionSeries, 1e18, -1e16, -1000e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e18, -1e16, -1000e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e18, -99e16, 100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e18, -99e16, 100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e18, -99e16, -100e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e18, -99e16, -100e18, 1000e18);
		_getSpreadValue(_optionSeries, 1e18, -99e16, 0, 2000e18);
		_getSpreadValue(_optionSeries, 1e18, -99e16, 0, 1000e18);
		_getSpreadValue(_optionSeries, 1e18, -99e16, -1000e18, 2000e18);
		_getSpreadValue(_optionSeries, 1e18, -99e16, -1000e18, 1000e18);
		// ---
		_getSpreadValue(_optionSeries, 1000e18, 5e17, 100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1000e18, 5e17, 100e18, 500e18);
		_getSpreadValue(_optionSeries, 1000e18, 5e17, -100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1000e18, 5e17, -100e18, 500e18);
		_getSpreadValue(_optionSeries, 1000e18, 5e17, 0, 10000e18);
		_getSpreadValue(_optionSeries, 1000e18, 5e17, 0, 500e18);
		_getSpreadValue(_optionSeries, 1000e18, 5e17, -1000e18, 10000e18);
		_getSpreadValue(_optionSeries, 1000e18, 5e17, -1000e18, 500e18);
		_getSpreadValue(_optionSeries, 1000e18, -5e17, 100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1000e18, -5e17, 100e18, 500e18);
		_getSpreadValue(_optionSeries, 1000e18, -5e17, -100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1000e18, -5e17, -100e18, 500e18);
		_getSpreadValue(_optionSeries, 1000e18, -5e17, 0, 10000e18);
		_getSpreadValue(_optionSeries, 1000e18, -5e17, 0, 500e18);
		_getSpreadValue(_optionSeries, 1000e18, -5e17, -1000e18, 10000e18);
		_getSpreadValue(_optionSeries, 1000e18, -5e17, -1000e18, 500e18);
		_getSpreadValue(_optionSeries, 1000e18, -1e16, 100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1000e18, -1e16, 100e18, 500e18);
		_getSpreadValue(_optionSeries, 1000e18, -1e16, -100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1000e18, -1e16, -100e18, 500e18);
		_getSpreadValue(_optionSeries, 1000e18, -1e16, 0, 10000e18);
		_getSpreadValue(_optionSeries, 1000e18, -1e16, 0, 500e18);
		_getSpreadValue(_optionSeries, 1000e18, -1e16, -1000e18, 10000e18);
		_getSpreadValue(_optionSeries, 1000e18, -1e16, -1000e18, 500e18);
		_getSpreadValue(_optionSeries, 1000e18, 99e16, 100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1000e18, 99e16, 100e18, 500e18);
		_getSpreadValue(_optionSeries, 1000e18, 99e16, -100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1000e18, 99e16, -100e18, 500e18);
		_getSpreadValue(_optionSeries, 1000e18, 99e16, 0, 10000e18);
		_getSpreadValue(_optionSeries, 1000e18, 99e16, 0, 500e18);
		_getSpreadValue(_optionSeries, 1000e18, 99e16, -1000e18, 10000e18);
		_getSpreadValue(_optionSeries, 1000e18, 99e16, -1000e18, 500e18);
		_getSpreadValue(_optionSeries, 1e16, 5e17, 100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e16, 5e17, 100e18, 500e18);
		_getSpreadValue(_optionSeries, 1e16, 5e17, -100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e16, 5e17, -100e18, 500e18);
		_getSpreadValue(_optionSeries, 1e16, 5e17, 0, 10000e18);
		_getSpreadValue(_optionSeries, 1e16, 5e17, 0, 500e18);
		_getSpreadValue(_optionSeries, 1e16, 5e17, -1000e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e16, 5e17, -1000e18, 500e18);
		_getSpreadValue(_optionSeries, 1e16, -5e17, 100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e16, -5e17, 100e18, 500e18);
		_getSpreadValue(_optionSeries, 1e16, -5e17, -100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e16, -5e17, -100e18, 500e18);
		_getSpreadValue(_optionSeries, 1e16, -5e17, 0, 10000e18);
		_getSpreadValue(_optionSeries, 1e16, -5e17, 0, 500e18);
		_getSpreadValue(_optionSeries, 1e16, -5e17, -1000e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e16, -5e17, -1000e18, 500e18);
		_getSpreadValue(_optionSeries, 1e16, -1e16, 100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e16, -1e16, 100e18, 500e18);
		_getSpreadValue(_optionSeries, 1e16, -1e16, -100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e16, -1e16, -100e18, 500e18);
		_getSpreadValue(_optionSeries, 1e16, -1e16, 0, 10000e18);
		_getSpreadValue(_optionSeries, 1e16, -1e16, 0, 500e18);
		_getSpreadValue(_optionSeries, 1e16, -1e16, -1000e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e16, -1e16, -1000e18, 500e18);
		_getSpreadValue(_optionSeries, 1e16, 99e16, 100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e16, 99e16, 100e18, 500e18);
		_getSpreadValue(_optionSeries, 1e16, 99e16, -100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e16, 99e16, -100e18, 500e18);
		_getSpreadValue(_optionSeries, 1e16, 99e16, 0, 10000e18);
		_getSpreadValue(_optionSeries, 1e16, 99e16, 0, 500e18);
		_getSpreadValue(_optionSeries, 1e16, 99e16, -1000e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e16, 99e16, -1000e18, 500e18);
		_getSpreadValue(_optionSeries, 50e18, 5e17, 100e18, 10000e18);
		_getSpreadValue(_optionSeries, 50e18, 5e17, 100e18, 500e18);
		_getSpreadValue(_optionSeries, 50e18, 5e17, -100e18, 10000e18);
		_getSpreadValue(_optionSeries, 50e18, 5e17, -100e18, 500e18);
		_getSpreadValue(_optionSeries, 50e18, 5e17, 0, 10000e18);
		_getSpreadValue(_optionSeries, 50e18, 5e17, 0, 500e18);
		_getSpreadValue(_optionSeries, 50e18, 5e17, -1000e18, 10000e18);
		_getSpreadValue(_optionSeries, 50e18, 5e17, -1000e18, 500e18);
		_getSpreadValue(_optionSeries, 50e18, -5e17, 100e18, 10000e18);
		_getSpreadValue(_optionSeries, 50e18, -5e17, 100e18, 500e18);
		_getSpreadValue(_optionSeries, 50e18, -5e17, -100e18, 10000e18);
		_getSpreadValue(_optionSeries, 50e18, -5e17, -100e18, 500e18);
		_getSpreadValue(_optionSeries, 50e18, -5e17, 0, 10000e18);
		_getSpreadValue(_optionSeries, 50e18, -5e17, 0, 500e18);
		_getSpreadValue(_optionSeries, 50e18, -5e17, -1000e18, 10000e18);
		_getSpreadValue(_optionSeries, 50e18, -5e17, -1000e18, 500e18);
		_getSpreadValue(_optionSeries, 50e18, -1e16, 100e18, 10000e18);
		_getSpreadValue(_optionSeries, 50e18, -1e16, 100e18, 500e18);
		_getSpreadValue(_optionSeries, 50e18, -1e16, -100e18, 10000e18);
		_getSpreadValue(_optionSeries, 50e18, -1e16, -100e18, 500e18);
		_getSpreadValue(_optionSeries, 50e18, -1e16, 0, 10000e18);
		_getSpreadValue(_optionSeries, 50e18, -1e16, 0, 500e18);
		_getSpreadValue(_optionSeries, 50e18, -1e16, -1000e18, 10000e18);
		_getSpreadValue(_optionSeries, 50e18, -1e16, -1000e18, 500e18);
		_getSpreadValue(_optionSeries, 50e18, 99e16, 100e18, 10000e18);
		_getSpreadValue(_optionSeries, 50e18, 99e16, 100e18, 500e18);
		_getSpreadValue(_optionSeries, 50e18, 99e16, -100e18, 10000e18);
		_getSpreadValue(_optionSeries, 50e18, 99e16, -100e18, 500e18);
		_getSpreadValue(_optionSeries, 50e18, 99e16, 0, 10000e18);
		_getSpreadValue(_optionSeries, 50e18, 99e16, 0, 500e18);
		_getSpreadValue(_optionSeries, 50e18, 99e16, -1000e18, 10000e18);
		_getSpreadValue(_optionSeries, 50e18, 99e16, -1000e18, 500e18);
		_getSpreadValue(_optionSeries, 1e18, 5e17, 100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e18, 5e17, 100e18, 500e18);
		_getSpreadValue(_optionSeries, 1e18, 5e17, -100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e18, 5e17, -100e18, 500e18);
		_getSpreadValue(_optionSeries, 1e18, 5e17, 0, 10000e18);
		_getSpreadValue(_optionSeries, 1e18, 5e17, 0, 500e18);
		_getSpreadValue(_optionSeries, 1e18, 5e17, -1000e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e18, 5e17, -1000e18, 500e18);
		_getSpreadValue(_optionSeries, 1e18, -5e17, 100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e18, -5e17, 100e18, 500e18);
		_getSpreadValue(_optionSeries, 1e18, -5e17, -100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e18, -5e17, -100e18, 500e18);
		_getSpreadValue(_optionSeries, 1e18, -5e17, 0, 10000e18);
		_getSpreadValue(_optionSeries, 1e18, -5e17, 0, 500e18);
		_getSpreadValue(_optionSeries, 1e18, -5e17, -1000e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e18, -5e17, -1000e18, 500e18);
		_getSpreadValue(_optionSeries, 1e18, -1e16, 100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e18, -1e16, 100e18, 500e18);
		_getSpreadValue(_optionSeries, 1e18, -1e16, -100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e18, -1e16, -100e18, 500e18);
		_getSpreadValue(_optionSeries, 1e18, -1e16, 0, 10000e18);
		_getSpreadValue(_optionSeries, 1e18, -1e16, 0, 500e18);
		_getSpreadValue(_optionSeries, 1e18, -1e16, -1000e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e18, -1e16, -1000e18, 500e18);
		_getSpreadValue(_optionSeries, 1e18, -99e16, 100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e18, -99e16, 100e18, 500e18);
		_getSpreadValue(_optionSeries, 1e18, -99e16, -100e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e18, -99e16, -100e18, 500e18);
		_getSpreadValue(_optionSeries, 1e18, -99e16, 0, 10000e18);
		_getSpreadValue(_optionSeries, 1e18, -99e16, 0, 500e18);
		_getSpreadValue(_optionSeries, 1e18, -99e16, -1000e18, 10000e18);
		_getSpreadValue(_optionSeries, 1e18, -99e16, -1000e18, 500e18);
	}

	function testSpreadValueFuzzAmount(uint80 _amount) public {
		vm.assume(_amount > 1e16);
		vm.assume(_amount < 1000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, 100e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, 100e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, -100e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, -100e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, 100e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, 100e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, -100e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, -100e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, 100e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, 100e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, -100e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, -100e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, 100e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, 100e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, -100e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, -100e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, 100e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, 100e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, -100e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, -100e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, 100e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, 100e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, -100e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, -100e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, 100e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, 100e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, -100e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, -100e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, 100e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, 100e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, -100e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, -100e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, 0, 2000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, 0, 1000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, -1000e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, -1000e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, 0, 2000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, 0, 1000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, -1000e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, -1000e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, 0, 2000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, 0, 1000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, -1000e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, -1000e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, 0, 2000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, 0, 1000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, -1000e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, -1000e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, 0, 2000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, 0, 1000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, -1000e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, -1000e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, 0, 2000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, 0, 1000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, -1000e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, -1000e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, 0, 2000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, 0, 1000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, -1000e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, -1000e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, 0, 2000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, 0, 1000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, -1000e18, 2000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, -1000e18, 1000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, 100e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, 100e18, 500e18);
		_getSpreadValue(optionSeries, _amount, 5e17, -100e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, -100e18, 500e18);
		_getSpreadValue(optionSeries, _amount, -5e17, 100e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, 100e18, 500e18);
		_getSpreadValue(optionSeries, _amount, -5e17, -100e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, -100e18, 500e18);
		_getSpreadValue(optionSeries, _amount, 5e17, 100e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, 100e18, 500e18);
		_getSpreadValue(optionSeries, _amount, 5e17, -100e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, -100e18, 500e18);
		_getSpreadValue(optionSeries, _amount, -5e17, 100e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, 100e18, 500e18);
		_getSpreadValue(optionSeries, _amount, -5e17, -100e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, -100e18, 500e18);
		_getSpreadValue(optionSeries, _amount, -1e16, 100e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, 100e18, 500e18);
		_getSpreadValue(optionSeries, _amount, -1e16, -100e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, -100e18, 500e18);
		_getSpreadValue(optionSeries, _amount, -1e16, 100e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, 100e18, 500e18);
		_getSpreadValue(optionSeries, _amount, -1e16, -100e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, -100e18, 500e18);
		_getSpreadValue(optionSeries, _amount, 99e16, 100e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, 100e18, 500e18);
		_getSpreadValue(optionSeries, _amount, 99e16, -100e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, -100e18, 500e18);
		_getSpreadValue(optionSeries, _amount, 99e16, 100e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, 100e18, 500e18);
		_getSpreadValue(optionSeries, _amount, 99e16, -100e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, -100e18, 500e18);
		_getSpreadValue(optionSeries, _amount, 5e17, 0, 10000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, 0, 500e18);
		_getSpreadValue(optionSeries, _amount, 5e17, -1000e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, -1000e18, 500e18);
		_getSpreadValue(optionSeries, _amount, -5e17, 0, 10000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, 0, 500e18);
		_getSpreadValue(optionSeries, _amount, -5e17, -1000e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, -1000e18, 500e18);
		_getSpreadValue(optionSeries, _amount, 5e17, 0, 10000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, 0, 500e18);
		_getSpreadValue(optionSeries, _amount, 5e17, -1000e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, 5e17, -1000e18, 500e18);
		_getSpreadValue(optionSeries, _amount, -5e17, 0, 10000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, 0, 500e18);
		_getSpreadValue(optionSeries, _amount, -5e17, -1000e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, -5e17, -1000e18, 500e18);
		_getSpreadValue(optionSeries, _amount, -1e16, 0, 10000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, 0, 500e18);
		_getSpreadValue(optionSeries, _amount, -1e16, -1000e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, -1000e18, 500e18);
		_getSpreadValue(optionSeries, _amount, -1e16, 0, 10000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, 0, 500e18);
		_getSpreadValue(optionSeries, _amount, -1e16, -1000e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, -1e16, -1000e18, 500e18);
		_getSpreadValue(optionSeries, _amount, 99e16, 0, 10000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, 0, 500e18);
		_getSpreadValue(optionSeries, _amount, 99e16, -1000e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, -1000e18, 500e18);
		_getSpreadValue(optionSeries, _amount, 99e16, 0, 10000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, 0, 500e18);
		_getSpreadValue(optionSeries, _amount, 99e16, -1000e18, 10000e18);
		_getSpreadValue(optionSeries, _amount, 99e16, -1000e18, 500e18);
	}

	function testSpreadValueFuzzDelta(int64 _delta) public {
		vm.assume(_delta <= 1e18);
		vm.assume(_delta >= -1e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, 100e18, 2000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, 100e18, 1000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, -100e18, 2000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, -100e18, 1000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, 100e18, 2000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, 100e18, 1000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, -100e18, 2000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, -100e18, 1000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, 100e18, 2000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, 100e18, 1000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, -100e18, 2000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, -100e18, 1000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, 100e18, 2000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, 100e18, 1000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, -100e18, 2000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, -100e18, 1000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, 100e18, 2000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, 100e18, 1000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, -100e18, 2000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, -100e18, 1000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, 100e18, 2000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, 100e18, 1000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, -100e18, 2000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, -100e18, 1000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, 100e18, 2000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, 100e18, 1000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, -100e18, 2000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, -100e18, 1000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, 100e18, 2000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, 100e18, 1000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, -100e18, 2000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, -100e18, 1000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, 0, 2000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, 0, 1000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, -1000e18, 2000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, -1000e18, 1000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, 0, 2000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, 0, 1000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, -1000e18, 2000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, -1000e18, 1000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, 0, 2000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, 0, 1000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, -1000e18, 2000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, -1000e18, 1000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, 0, 2000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, 0, 1000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, -1000e18, 2000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, -1000e18, 1000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, 0, 2000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, 0, 1000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, -1000e18, 2000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, -1000e18, 1000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, 0, 2000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, 0, 1000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, -1000e18, 2000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, -1000e18, 1000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, 0, 2000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, 0, 1000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, -1000e18, 2000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, -1000e18, 1000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, 0, 2000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, 0, 1000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, -1000e18, 2000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, -1000e18, 1000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, 100e18, 10000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, 100e18, 500e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, -100e18, 10000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, -100e18, 500e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, 100e18, 10000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, 100e18, 500e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, -100e18, 10000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, -100e18, 500e18);
		_getSpreadValue(optionSeries, 1e16, _delta, 100e18, 10000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, 100e18, 500e18);
		_getSpreadValue(optionSeries, 1e16, _delta, -100e18, 10000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, -100e18, 500e18);
		_getSpreadValue(optionSeries, 1e16, _delta, 100e18, 10000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, 100e18, 500e18);
		_getSpreadValue(optionSeries, 1e16, _delta, -100e18, 10000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, -100e18, 500e18);
		_getSpreadValue(optionSeries, 50e18, _delta, 100e18, 10000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, 100e18, 500e18);
		_getSpreadValue(optionSeries, 50e18, _delta, -100e18, 10000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, -100e18, 500e18);
		_getSpreadValue(optionSeries, 50e18, _delta, 100e18, 10000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, 100e18, 500e18);
		_getSpreadValue(optionSeries, 50e18, _delta, -100e18, 10000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, -100e18, 500e18);
		_getSpreadValue(optionSeries, 1e18, _delta, 100e18, 10000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, 100e18, 500e18);
		_getSpreadValue(optionSeries, 1e18, _delta, -100e18, 10000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, -100e18, 500e18);
		_getSpreadValue(optionSeries, 1e18, _delta, 100e18, 10000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, 100e18, 500e18);
		_getSpreadValue(optionSeries, 1e18, _delta, -100e18, 10000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, -100e18, 500e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, 0, 10000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, 0, 500e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, -1000e18, 10000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, -1000e18, 500e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, 0, 10000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, 0, 500e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, -1000e18, 10000e18);
		_getSpreadValue(optionSeries, 1000e18, _delta, -1000e18, 500e18);
		_getSpreadValue(optionSeries, 1e16, _delta, 0, 10000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, 0, 500e18);
		_getSpreadValue(optionSeries, 1e16, _delta, -1000e18, 10000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, -1000e18, 500e18);
		_getSpreadValue(optionSeries, 1e16, _delta, 0, 10000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, 0, 500e18);
		_getSpreadValue(optionSeries, 1e16, _delta, -1000e18, 10000e18);
		_getSpreadValue(optionSeries, 1e16, _delta, -1000e18, 500e18);
		_getSpreadValue(optionSeries, 50e18, _delta, 0, 10000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, 0, 500e18);
		_getSpreadValue(optionSeries, 50e18, _delta, -1000e18, 10000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, -1000e18, 500e18);
		_getSpreadValue(optionSeries, 50e18, _delta, 0, 10000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, 0, 500e18);
		_getSpreadValue(optionSeries, 50e18, _delta, -1000e18, 10000e18);
		_getSpreadValue(optionSeries, 50e18, _delta, -1000e18, 500e18);
		_getSpreadValue(optionSeries, 1e18, _delta, 0, 10000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, 0, 500e18);
		_getSpreadValue(optionSeries, 1e18, _delta, -1000e18, 10000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, -1000e18, 500e18);
		_getSpreadValue(optionSeries, 1e18, _delta, 0, 10000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, 0, 500e18);
		_getSpreadValue(optionSeries, 1e18, _delta, -1000e18, 10000e18);
		_getSpreadValue(optionSeries, 1e18, _delta, -1000e18, 500e18);
	}

	function testSpreadValueFuzzNetDhvExposure(int96 _netDhvExposure) public {
		vm.assume(_netDhvExposure <= 50000e18);
		vm.assume(_netDhvExposure >= -50000e18);
		_getSpreadValue(optionSeries, 1000e18, 5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1000e18, 5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1000e18, 5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1000e18, 5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1000e18, -5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1000e18, -5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1000e18, -5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1000e18, -5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1e16, 5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1e16, 5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1e16, 5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1e16, 5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1e16, -5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1e16, -5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1e16, -5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1e16, -5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 50e18, 5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 50e18, 5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 50e18, 5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 50e18, 5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 50e18, -5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 50e18, -5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 50e18, -5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 50e18, -5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1e18, 5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1e18, 5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1e18, 5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1e18, 5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1e18, -5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1e18, -5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1e18, -5e17, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1e18, -5e17, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1000e18, -1e16, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1000e18, -1e16, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1000e18, -1e16, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1000e18, -1e16, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1000e18, 99e16, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1000e18, 99e16, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1000e18, 99e16, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1000e18, 99e16, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1e16, -1e16, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1e16, -1e16, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1e16, -1e16, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1e16, -1e16, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1e16, 99e16, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1e16, 99e16, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1e16, 99e16, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1e16, 99e16, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 50e18, -1e16, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 50e18, -1e16, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 50e18, -1e16, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 50e18, -1e16, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 50e18, 99e16, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 50e18, 99e16, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 50e18, 99e16, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 50e18, 99e16, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1e18, -1e16, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1e18, -1e16, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1e18, -1e16, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1e18, -1e16, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1e18, 99e16, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1e18, 99e16, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1e18, 99e16, _netDhvExposure, 2000e18);
		_getSpreadValue(optionSeries, 1e18, 99e16, _netDhvExposure, 1000e18);
		_getSpreadValue(optionSeries, 1000e18, 5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1000e18, 5e17, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1000e18, 5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1000e18, 5e17, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1000e18, -5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1000e18, -5e17, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1000e18, -5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1000e18, -5e17, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1e16, 5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1e16, 5e17, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1e16, 5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1e16, 5e17, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1e16, -5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1e16, -5e17, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1e16, -5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1e16, -5e17, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 50e18, 5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 50e18, 5e17, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 50e18, 5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 50e18, 5e17, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 50e18, -5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 50e18, -5e17, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 50e18, -5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 50e18, -5e17, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1e18, 5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1e18, 5e17, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1e18, 5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1e18, 5e17, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1e18, -5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1e18, -5e17, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1e18, -5e17, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1e18, -5e17, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1000e18, -1e16, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1000e18, -1e16, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1000e18, -1e16, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1000e18, -1e16, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1000e18, 99e16, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1000e18, 99e16, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1000e18, 99e16, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1000e18, 99e16, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1e16, -1e16, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1e16, -1e16, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1e16, -1e16, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1e16, -1e16, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1e16, 99e16, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1e16, 99e16, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1e16, 99e16, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1e16, 99e16, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 50e18, -1e16, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 50e18, -1e16, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 50e18, -1e16, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 50e18, -1e16, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 50e18, 99e16, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 50e18, 99e16, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 50e18, 99e16, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 50e18, 99e16, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1e18, -1e16, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1e18, -1e16, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1e18, -1e16, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1e18, -1e16, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1e18, 99e16, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1e18, 99e16, _netDhvExposure, 500e18);
		_getSpreadValue(optionSeries, 1e18, 99e16, _netDhvExposure, 10000e18);
		_getSpreadValue(optionSeries, 1e18, 99e16, _netDhvExposure, 500e18);
	}

	function testSpreadValueFuzzUnderlyingPrice(uint80 _underlyingPrice) public {
		vm.assume(_underlyingPrice <= 50000e18);
		vm.assume(_underlyingPrice >= 50e18);
		_getSpreadValue(optionSeries, 1000e18, 5e17, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, 5e17, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, 5e17, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, 5e17, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, -5e17, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, -5e17, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, -5e17, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, -5e17, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, 5e17, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, 5e17, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, 5e17, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, 5e17, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, -5e17, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, -5e17, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, -5e17, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, -5e17, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, 5e17, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, 5e17, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, 5e17, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, 5e17, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, -5e17, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, -5e17, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, -5e17, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, -5e17, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, 5e17, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, 5e17, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, 5e17, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, 5e17, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, -5e17, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, -5e17, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, -5e17, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, -5e17, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, -1e16, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, -1e16, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, -1e16, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, -1e16, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, 99e16, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, 99e16, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, 99e16, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, 99e16, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, -1e16, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, -1e16, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, -1e16, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, -1e16, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, 99e16, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, 99e16, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, 99e16, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, 99e16, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, -1e16, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, -1e16, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, -1e16, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, -1e16, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, 99e16, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, 99e16, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, 99e16, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, 99e16, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, -1e16, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, -1e16, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, -1e16, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, -1e16, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, 99e16, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, 99e16, 100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, 99e16, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, 99e16, -100e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, 5e17, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, 5e17, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, 5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, 5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, -5e17, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, -5e17, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, -5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, -5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, 5e17, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, 5e17, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, 5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, 5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, -5e17, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, -5e17, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, -5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, -5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, 5e17, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, 5e17, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, 5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, 5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, -5e17, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, -5e17, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, -5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, -5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, 5e17, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, 5e17, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, 5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, 5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, -5e17, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, -5e17, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, -5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, -5e17, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, -1e16, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, -1e16, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, -1e16, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, -1e16, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, 99e16, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, 99e16, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, 99e16, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1000e18, 99e16, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, -1e16, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, -1e16, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, -1e16, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, -1e16, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, 99e16, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, 99e16, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, 99e16, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e16, 99e16, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, -1e16, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, -1e16, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, -1e16, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, -1e16, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, 99e16, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, 99e16, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, 99e16, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 50e18, 99e16, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, -1e16, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, -1e16, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, -1e16, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, -1e16, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, 99e16, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, 99e16, 0, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, 99e16, -1000e18, _underlyingPrice);
		_getSpreadValue(optionSeries, 1e18, 99e16, -1000e18, _underlyingPrice);
	}

	// function testSlippageFFIGetSlippageMultiplier() public {

	// }

	// function testSlippageFFIFuzzPriceGetSlippageMultiplier(uint128 underlyingPrice) public {
	// }

	function getSpreadValue(
		Types.OptionSeries memory _optionSeries,
		uint256 _amount,
		int256 _optionDelta,
		int256 _netDhvExposure,
		uint256 _underlyingPrice
	) private returns (uint256) {}

	// FUNCTION TO BE FUZZED

	/**
	 * @notice function to add slippage to orders to prevent over-exposure to a single option type
	 * @param _amount amount of options contracts being traded. e18
	 * @param _optionDelta the delta exposure of the option
	 * @param _netDhvExposure how many contracts of this series the DHV is already exposed to. e18. negative if net short.
	 * @param _underlyingPrice e18 price of ETH
	 */
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
		uint256 collateralToLend = _getCollateralRequirements();
		// get duration of option in years
		uint256 time = (_optionSeries.expiration - block.timestamp).div(ONE_YEAR_SECONDS);
		// calculate the collateral cost portion of the spread
		uint256 collateralLendingPremium = ((1e18 + (collateralLendingRate * 1e18) / MAX_BPS).pow(time))
			.mul(collateralToLend) - collateralToLend;
		// this is just a magnitude value, sign doesnt matter
		uint256 dollarDelta = uint256(_optionDelta.abs()).mul(_amount).mul(_underlyingPrice);
		uint256 deltaBorrowPremium;
		if (_optionDelta < 0) {
			// option is negative delta, resulting in long delta exposure for DHV. needs hedging with a short pos
			deltaBorrowPremium =
				dollarDelta.mul((1e18 + (shortDeltaBorrowRate * 1e18) / MAX_BPS).pow(time)) -
				dollarDelta;
		} else {
			// option is positive delta, resulting in short delta exposure for DHV. needs hedging with a long pos
			deltaBorrowPremium =
				dollarDelta.mul((1e18 + (longDeltaBorrowRate * 1e18) / MAX_BPS).pow(time)) -
				dollarDelta;
		}
		console.log("net short contracts:", netShortContracts);
		console.log("collateral lending premium:", collateralLendingPremium);
		console.log("delta borrow premium:", deltaBorrowPremium);
		console.log("total spread premium:", collateralLendingPremium + deltaBorrowPremium);
		return collateralLendingPremium + deltaBorrowPremium;
	}

	function _getCollateralRequirements() internal view returns (uint256) {
		return collateralRequirements;
	}
}
