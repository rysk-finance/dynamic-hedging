pragma solidity 0.8.10;

import "forge-std/Test.sol";
import "../../contracts/VolatilityFeed.sol";
import "../../contracts/Authority.sol";
import "forge-std/console.sol";

contract ContractBTest is Test {
	VolatilityFeed public volFeed;
    uint256 public startExpiry;

	function setUp() public {
		Authority auth = new Authority(address(this), msg.sender, msg.sender);
		volFeed = new VolatilityFeed(address(auth));
        VolatilityFeed.SABRParams memory _sabrParams = VolatilityFeed.SABRParams(
			250000,
			1000000,
			-300000,
			1500000,
			250000,
			1000000,
			-300000,
			1500000
		);
        startExpiry = block.timestamp + 30*24*60*60;
		volFeed.setSabrParameters(_sabrParams, startExpiry);
	}

	function testGetKeeper() public {
		bool isKeeper = volFeed.keeper(msg.sender);
		assertEq(isKeeper, false);
	}

	function testSetKeeper() public {
		volFeed.setKeeper(msg.sender, true);
		bool isKeeper = volFeed.keeper(msg.sender);
		assertEq(isKeeper, true);
	}

	function testSetSabrParams() public {
		VolatilityFeed.SABRParams memory _sabrParams = VolatilityFeed.SABRParams(
			250000,
			1000000,
			-300000,
			1500000,
			250000,
			1000000,
			-300000,
			1500000
		);
		uint256 _expiry = 10;
		volFeed.setSabrParameters(_sabrParams, _expiry);
		(
			int32 callAlpha,
			int32 callBeta,
			int32 callRho,
			int32 callVolvol,
			int32 putAlpha,
			int32 putBeta,
			int32 putRho,
			int32 putVolvol
		) = volFeed.sabrParams(_expiry);
		assertEq(callAlpha, _sabrParams.callAlpha);
		assertEq(callBeta, _sabrParams.callBeta);
		assertEq(callRho, _sabrParams.callRho);
		assertEq(callVolvol, _sabrParams.callVolvol);
		assertEq(putAlpha, _sabrParams.putAlpha);
		assertEq(putBeta, _sabrParams.putBeta);
		assertEq(putRho, _sabrParams.putRho);
		assertEq(putVolvol, _sabrParams.putVolvol);
	}

    function testFuzzAlpha(int32 var_) public {
        vm.assume(var_ > 0);
		VolatilityFeed.SABRParams memory _sabrParams = VolatilityFeed.SABRParams(
			var_,
			1000000,
			-300000,
			1500000,
			var_,
			1000000,
			-300000,
			1500000
		);
		 uint256 expiration = startExpiry;
        volFeed.setSabrParameters(_sabrParams, expiration);
        (int32 _var1,,,,int32 _var2,,,) = volFeed.sabrParams(expiration);
		assertEq(_var1, var_);
        assertEq(_var2, var_);
        bool isPut = false;
        uint256 underlyingPrice = 100e18;
        uint256 strikePrice = 120e18;
        uint256 vol = volFeed.getImpliedVolatility(isPut, underlyingPrice, strikePrice, expiration); 
	}
    
    function testFuzzRho(int32 var_) public {
        vm.assume(var_ > -1000000);
        vm.assume(var_ <  1000000);
		VolatilityFeed.SABRParams memory _sabrParams = VolatilityFeed.SABRParams(
			250000,
			1000000,
			var_,
			1500000,
			250000,
			1000000,
			var_,
			1500000
		);
		 uint256 expiration = startExpiry;
        volFeed.setSabrParameters(_sabrParams, expiration);
        (,,int32 _var1,,,,int32 _var2,) = volFeed.sabrParams(expiration);
		assertEq(_var1, var_);
        assertEq(_var2, var_);
        bool isPut = false;
        uint256 underlyingPrice = 100e18;
        uint256 strikePrice = 120e18;
        uint256 vol = volFeed.getImpliedVolatility(isPut, underlyingPrice, strikePrice, expiration); 
	}

    function testFuzzVolvol(int32 var_) public {
        vm.assume(var_ > 0);
		VolatilityFeed.SABRParams memory _sabrParams = VolatilityFeed.SABRParams(
			250000,
			1000000,
			-300000,
			var_,
			250000,
			1000000,
			-300000,
			var_
		);
		 uint256 expiration = startExpiry;
        volFeed.setSabrParameters(_sabrParams, expiration);
        (,,,int32 _var1,,,,int32 _var2) = volFeed.sabrParams(expiration);
		assertEq(_var1, var_);
        assertEq(_var2, var_);
        bool isPut = false;
        uint256 underlyingPrice = 100e18;
        uint256 strikePrice = 120e18;
        uint256 vol = volFeed.getImpliedVolatility(isPut, underlyingPrice, strikePrice, expiration); 
	}

    function testFuzzPrice(uint256 underlyingPrice) public {
        underlyingPrice = bound(underlyingPrice, 1e18, 1e26);
        bool isPut = false;
        uint256 strikePrice = 120e18;
        uint256 expiration = startExpiry;
        uint256 vol = volFeed.getImpliedVolatility(isPut, underlyingPrice, strikePrice, expiration); 
    }

    function testGetImpliedVolatility() public {
        uint256 expiration = startExpiry;
        bool isPut = false;
        uint256 underlyingPrice = 100e18;
        uint256 strikePrice = 120e18;
        uint256 vol = volFeed.getImpliedVolatility(isPut, underlyingPrice, strikePrice, expiration); 
        assertApproxEqAbs(vol, 0.2591e18, 1e14);
    }

}
