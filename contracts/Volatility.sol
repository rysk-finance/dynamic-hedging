pragma solidity >=0.8.9;
pragma experimental ABIEncoderV2;

import { OptionsCompute } from "./libraries/OptionsCompute.sol";
import { Constants } from "./libraries/Constants.sol";
import "./libraries/ABDKMathQuad.sol";

contract Volatility {
    using ABDKMathQuad for uint256;
    using ABDKMathQuad for bytes16;
    using ABDKMathQuad for int256;

    function computeIVFromSkewInts(
       int[7] memory coef,
       int[2] memory points
    ) public pure returns (int) {
        bytes16[7] memory bCoef;
        bytes16[2] memory bPoints;
        for(uint i=0; i < 7; i++) {
            bytes16 value = coef[i].fromInt().div(Constants.decimalPlace());
            bCoef[i] = value;

            if (i < 2) {
                bPoints[i] = points[i].fromInt().div(Constants.decimalPlace());
            }
        }
        return OptionsCompute.computeIVFromSkew(bCoef, bPoints).mul(Constants.decimalPlace()).toInt();
    }
}
