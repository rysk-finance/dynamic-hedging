pragma solidity 0.8.10;

import "forge-std/Test.sol";
import "../../contracts/VolatilityFeed.sol";
import "../../contracts/Authority.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract SlippageTest is Test {
    using Strings for uint256;
    using Strings for int256;

	function setUp() public {
		Authority auth = new Authority(address(this), msg.sender, msg.sender);
	}


	function testQuoteFFIGetSlippageMultiplier() public {

	}

	function testQuoteFFIFuzzPriceGetSlippageMultiplier(uint128 underlyingPrice) public {
	}

	function getSlippageMultiplier(
		uint256 amount,
        int256 netDhvExposure,
        bool isSellBool,
        uint256 slippageGradient,
        uint256 slippageGradientMultiplier
	) private returns (uint256) {
        uint256 isNetDhvExposureNegative;
		uint256 isSell;
        if (netDhvExposure < 0) {
            isNetDhvExposureNegative = 1;
            netDhvExposure = -netDhvExposure;
        }
		if (isSellBool) {
			isSell = 1;
		}
        string[] memory inputs = new string[](14);
        inputs[0] = "python3";
        inputs[1] = "test/foundry/quote.py";
        inputs[2] = "--amount";
        inputs[3] = uint256(amount).toString();
        inputs[4] = "--netDhvExposure";
        inputs[5] = uint256(netDhvExposure).toString();
        inputs[6] = "--isNetDhvExposureNegative";
        inputs[7] = uint256(isNetDhvExposureNegative).toString();
        inputs[8] = "--isSell";
        inputs[9] = uint256(isSell).toString();
        inputs[10] = "--slippageGradient";
        inputs[11] = uint256(slippageGradient).toString();
        inputs[12] = "--slippageGradientMultiplier";
        inputs[13] = uint256(slippageGradientMultiplier).toString();        
        bytes memory res = vm.ffi(inputs);
        uint256 vol = abi.decode(res, (uint256));
        return vol;
    }
}
