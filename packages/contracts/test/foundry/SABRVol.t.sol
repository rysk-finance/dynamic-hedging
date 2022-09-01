pragma solidity 0.8.10;

import "forge-std/Test.sol";
import "../../contracts/VolatilityFeed.sol";
import "../../contracts/Authority.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract SABRTest is Test {
    using Strings for uint256;
    using Strings for int256;
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
		startExpiry = block.timestamp + 30 * 24 * 60 * 60;
		volFeed.setSabrParameters(_sabrParams, startExpiry);
	}

	function testSABRGetKeeper() public {
		bool isKeeper = volFeed.keeper(msg.sender);
		assertEq(isKeeper, false);
	}

	function testSABRSetKeeper() public {
		volFeed.setKeeper(msg.sender, true);
		bool isKeeper = volFeed.keeper(msg.sender);
		assertEq(isKeeper, true);
	}

	function testSABRSetSabrParams() public {
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

	function testSABRFuzzAlpha(int32 var_) public {
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
		(int32 _var1, , , , int32 _var2, , , ) = volFeed.sabrParams(expiration);
		assertEq(_var1, var_);
		assertEq(_var2, var_);
		bool isPut = false;
		uint256 underlyingPrice = 100e18;
		uint256 strikePrice = 120e18;
		uint256 vol = volFeed.getImpliedVolatility(isPut, underlyingPrice, strikePrice, expiration);
	}

	function testSABRFuzzRho(int32 var_) public {
		vm.assume(var_ > -1000000);
		vm.assume(var_ < 1000000);
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
		(, , int32 _var1, , , , int32 _var2, ) = volFeed.sabrParams(expiration);
		assertEq(_var1, var_);
		assertEq(_var2, var_);
		bool isPut = false;
		uint256 underlyingPrice = 100e18;
		uint256 strikePrice = 120e18;
		uint256 vol = volFeed.getImpliedVolatility(isPut, underlyingPrice, strikePrice, expiration);
	}

	function testSABRFuzzVolvol(int32 var_) public {
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
		(, , , int32 _var1, , , , int32 _var2) = volFeed.sabrParams(expiration);
		assertEq(_var1, var_);
		assertEq(_var2, var_);
		bool isPut = false;
		uint256 underlyingPrice = 100e18;
		uint256 strikePrice = 120e18;
		uint256 vol = volFeed.getImpliedVolatility(isPut, underlyingPrice, strikePrice, expiration);
	}

	function testSABRFuzzPrice(uint256 underlyingPrice) public {
		underlyingPrice = bound(underlyingPrice, 1e18, 1e26);
		bool isPut = false;
		uint256 strikePrice = 120e18;
		uint256 expiration = startExpiry;
		uint256 vol = volFeed.getImpliedVolatility(isPut, underlyingPrice, strikePrice, expiration);
	}

	function testSABRFFIGetImpliedVolatility() public {
		uint256 expiration = startExpiry;
		bool isPut = false;
		uint256 underlyingPrice = 100e18;
		uint256 strikePrice = 120e18;
		uint256 vol = volFeed.getImpliedVolatility(isPut, underlyingPrice, strikePrice, expiration);
		assertApproxEqAbs(vol, 0.2591e18, 1e14);
        (int32 alpha, int32 beta, int32 rho, int32 nu, , , ,) = volFeed.sabrParams(expiration);
        uint256 expectedVol = calculateVol(strikePrice, underlyingPrice, expiration, alpha, beta, rho, nu);
        console.log(vol);
        console.log(expectedVol);
        assertApproxEqAbs(vol, expectedVol, 1e4);
	}

	function testSABRFFIFuzzPriceGetImpliedVolatility(uint128 underlyingPrice) public {
		vm.assume(underlyingPrice > 10e18);
		uint256 expiration = startExpiry;
		bool isPut = false;
		uint256 strikePrice = 120e18;
		uint256 vol = volFeed.getImpliedVolatility(isPut, underlyingPrice, strikePrice, expiration);
        (int32 alpha, int32 beta, int32 rho, int32 nu, , , ,) = volFeed.sabrParams(expiration);
        uint256 expectedVol = calculateVol(strikePrice, underlyingPrice, expiration, alpha, beta, rho, nu);
        console.log(vol);
        console.log(expectedVol);
        assertApproxEqAbs(vol, expectedVol, 1e8);
	}

	function testSABRFFIStrikeGetImpliedVolatility() public {
		uint256 expiration = startExpiry;
		bool isPut = false;
        uint256 underlyingPrice = 100e18;
        uint256 strikePrice = 2000e18;
		uint256 vol = volFeed.getImpliedVolatility(isPut, underlyingPrice, strikePrice, expiration);
        (int32 alpha, int32 beta, int32 rho, int32 nu, , , ,) = volFeed.sabrParams(expiration);
        uint256 expectedVol = calculateVol(strikePrice, underlyingPrice, expiration, alpha, beta, rho, nu);
        console.log(vol);
        console.log(expectedVol);
        assertApproxEqAbs(vol, expectedVol, 1e8);
	}

	function testSABRFFIFuzzStrikeGetImpliedVolatility(uint128 strikePrice) public {
        bound(strikePrice, 10e18, 1000e18);
		uint256 expiration = startExpiry;
		bool isPut = false;
        uint256 underlyingPrice = 100e18;
		uint256 vol = volFeed.getImpliedVolatility(isPut, underlyingPrice, strikePrice, expiration);
        (int32 alpha, int32 beta, int32 rho, int32 nu, , , ,) = volFeed.sabrParams(expiration);
        uint256 expectedVol = calculateVol(strikePrice, underlyingPrice, expiration, alpha, beta, rho, nu);
        console.log(vol);
        console.log(expectedVol);
        assertApproxEqAbs(vol, expectedVol, 1e9);
	}

	function calculateVol(
		uint256 k,
		uint256 f,
		uint256 expiration,
		int256 alpha,
		int256 beta,
		int256 rho,
		int256 nu
	) private returns (uint256) {
        uint256 isRhoNegative;
        if (rho < 0) {
            isRhoNegative = 1;
            rho = -rho;
        }
        string[] memory inputs = new string[](20);
        inputs[0] = "python3";
        inputs[1] = "test/foundry/sabr.py";
        inputs[2] = "--k";
        inputs[3] = uint256(k).toString();
        inputs[4] = "--f";
        inputs[5] = uint256(f).toString();
        inputs[6] = "--expiration";
        inputs[7] = uint256(expiration).toString();
        inputs[8] = "--now";
        inputs[9] = uint256(block.timestamp).toString();
        inputs[10] = "--alpha";
        inputs[11] = uint256(alpha).toString();
        inputs[12] = "--beta";
        inputs[13] = uint256(beta).toString();        
        inputs[14] = "--rho";
        inputs[15] = uint256(rho).toString(); 
        inputs[16] = "--nu";
        inputs[17] = uint256(nu).toString(); 
        inputs[18] = "--isRhoNegative";
        inputs[19] = uint256(isRhoNegative).toString();
        bytes memory res = vm.ffi(inputs);
        uint256 vol = abi.decode(res, (uint256));
        return vol;
    }
}
