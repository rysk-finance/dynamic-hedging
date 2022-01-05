pragma solidity >=0.8.9;
pragma experimental ABIEncoderV2;

import { OptionsCompute } from "./libraries/OptionsCompute.sol";
import "./libraries/ABDKMathQuad.sol";

contract Volatility {
    using ABDKMathQuad for uint256;
    using ABDKMathQuad for bytes16;
    using ABDKMathQuad for int256;

    function computeIVFromSkewInts(
       int[7] memory coef,
       int[2] memory points
    ) public pure returns (int) {
        return OptionsCompute.computeIVFromSkew(coef, points);
    }
}
