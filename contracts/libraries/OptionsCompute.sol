pragma solidity >=0.8.0;

import { ABDKMathQuad } from "./ABDKMathQuad.sol";
import { Constants } from "./Constants.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";


library OptionsCompute {
    using ABDKMathQuad for bytes16;
    using PRBMathUD60x18 for uint256;
    using PRBMathSD59x18 for int256;

    bytes16 private constant DECIMAL_PLACE = 0x403abc16d674ec800000000000000000;
    bytes16 private constant ONE = 0x3fff0000000000000000000000000000;
    bytes16 private constant TWO = 0x40000000000000000000000000000000;

    function computeEscrow(uint amount, uint strike, uint underlyingDecimals)
        internal
        pure
        returns (uint)
    {
        uint decimalShift = 18 - underlyingDecimals;
        return strike.mul(amount).div(10**(8 + decimalShift));
    }

    function toUInt(bytes16 x)
        internal
        pure
        returns (uint)
    {
        return x.mul(DECIMAL_PLACE).toUInt();
    }

    function computeNewWeights(
       uint amount,
       uint strike,
       uint expiration,
       uint totalAmount,
       uint weightedStrike,
       uint weightedTime
    ) internal pure returns (uint, uint, uint) {
        uint weight = PRBMathUD60x18.scale();
        if (totalAmount > 0) {
            weight = amount.div(totalAmount);
        }
        uint exWeight = PRBMathUD60x18.scale() - weight;
        uint newTotalAmount = totalAmount + amount;
        uint newWeightedStrike = (exWeight.mul(weightedStrike)) + (weight.mul(strike));
        uint newWeightedTime = (exWeight.mul(weightedTime)) + (weight.mul(expiration));
        return (newTotalAmount, newWeightedStrike, newWeightedTime);
    }

    // @param points[0] spot distance
    // @param points[1] expiration time
    // @param coef degree-2 polynomial features are [intercept, 1, a, b, a^2, ab, b^2]
    // a == spot_distance, b == expiration time
    // spot_distance = (strike - spot_price) / spot_price
    function computeIVFromSkew(
       int[7] memory coef,
       int[2] memory points
    ) internal pure returns (int){
        int iPlusC1 = coef[0] + coef[1];
        int c2PlusC3 = coef[2].mul(points[0]) + (coef[3].mul(points[1]));
        int c4PlusC5 = coef[4].mul(points[0].mul(points[0])) + (coef[5].mul(points[0]).mul(points[1]));
        return iPlusC1 + c2PlusC3 + c4PlusC5 + (coef[6].mul(points[1].mul(points[1])));
    }
}
