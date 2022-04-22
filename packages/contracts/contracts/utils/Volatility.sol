pragma solidity >=0.8.9;

import { OptionsCompute } from "../libraries/OptionsCompute.sol";

contract Volatility {

    function computeIVFromSkewInts(
       int[7] memory coef,
       int[2] memory points
    ) public pure returns (int) {
        return OptionsCompute.computeIVFromSkew(coef, points);
    }
}
