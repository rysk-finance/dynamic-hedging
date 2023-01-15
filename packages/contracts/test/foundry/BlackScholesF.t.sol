pragma solidity 0.8.10;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "contracts/utils/BlackScholesTest.sol";

contract BSTest is Test {
	BlackScholesTest public bs;


	function setUp() public {
		bs = new BlackScholesTest();
	}

	function testBSGetDelta() public {
        uint256 price = 100e18;
		uint256 strike = 120e18;
		uint256 expiration = 1664533659;
		uint256 vol = 1e18;
		uint256 rfr = 1e17;
		bool isPut = false;
        bs.getDelta(price, strike, expiration, vol, rfr, isPut);
	}

	function testBSGetQuote() public {
        uint256 price = 100e18;
		uint256 strike = 120e18;
		uint256 expiration = 1664533659;
		uint256 vol = 1e18;
		uint256 rfr = 1e17;
		bool isPut = false;
        bs.retBlackScholesCalc(price, strike, expiration, vol, rfr, isPut);
	}

	function testBSFuzzPriceGetDelta(uint256 price) public {
		vm.assume(price > 1e18);
		uint256 strike = 120e18;
		uint256 expiration = 1664533659;
		uint256 vol = 1e18;
		uint256 rfr = 1e17;
		bool isPut = false;
        bs.getDelta(price, strike, expiration, vol, rfr, isPut);
	}

	function testBSFuzzStrikeGetDelta(uint256 strike) public {
		vm.assume(strike > 1e18);
		vm.assume(strike < 100000e18);
		uint256 price = 100e18;
		uint256 expiration = 1664533659;
		uint256 vol = 1e18;
		uint256 rfr = 1e17;
		bool isPut = false;
        bs.getDelta(price, strike, expiration, vol, rfr, isPut);
	}
	function testBSFuzzVolGetDelta(uint256 vol) public {
		vm.assume(vol > 1e16);
		vm.assume(vol < 1000e18);
		uint256 price = 100e18;
		uint256 strike = 120e18;
		uint256 expiration = 1664533659;
		uint256 rfr = 1e17;
		bool isPut = false;
        bs.getDelta(price, strike, expiration, vol, rfr, isPut);
	}

	function testBSFuzzPriceGetQuote(uint256 price) public {
		vm.assume(price > 1e18);
		vm.assume(price < 100000e18);
		uint256 strike = 120e18;
		uint256 expiration = 1664533659;
		uint256 vol = 1e18;
		uint256 rfr = 1e17;
		bool isPut = false;
        uint256 prem = bs.retBlackScholesCalc(price, strike, expiration, vol, rfr, isPut);
		require(prem < 100000000e18);
	}

	function testBSFuzzStrikeGetQuote(uint256 strike) public {
		vm.assume(strike > 1e18);
		vm.assume(strike < 100000e18);
		uint256 price = 100e18;
		uint256 expiration = 1664533659;
		uint256 vol = 1e18;
		uint256 rfr = 1e17;
		bool isPut = false;
        uint256 prem = bs.retBlackScholesCalc(price, strike, expiration, vol, rfr, isPut);
		require(prem < 100000000e18);
	}
	function testBSFuzzVolGetQuote(uint256 vol) public {
		vm.assume(vol > 1e16);
		vm.assume(vol < 1000e18);
		uint256 price = 100e18;
		uint256 strike = 120e18;
		uint256 expiration = 1664533659;
		uint256 rfr = 1e17;
		bool isPut = false;
        uint256 prem = bs.retBlackScholesCalc(price, strike, expiration, vol, rfr, isPut);
		require(prem < 10000000e18);
	}
}
