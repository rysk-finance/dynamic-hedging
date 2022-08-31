pragma solidity 0.8.10;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "contracts/utils/BlackScholesTest.sol";

contract BSTest is Test {
	BlackScholesTest public bs;


	function setUp() public {
		bs = new BlackScholesTest();
	}

	function testGetDelta() public {
        uint256 price = 100e18;
		uint256 strike = 120e18;
		uint256 expiration = 1664533659;
		uint256 vol = 1e18;
		uint256 rfr = 1e17;
		bool isPut = false;
        bs.getDelta(price, strike, expiration, vol, rfr, isPut);
	}

}
