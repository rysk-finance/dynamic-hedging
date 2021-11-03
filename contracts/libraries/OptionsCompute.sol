pragma solidity >=0.8.0;

import { ABDKMathQuad } from "./ABDKMathQuad.sol";
import { Constants } from "./Constants.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";

library OptionsCompute {
    using ABDKMathQuad for bytes16;
    using ABDKMathQuad for int256;
    using PRBMathUD60x18 for uint256;

    bytes16 private constant DECIMAL_PLACE = 0x403abc16d674ec800000000000000000;
    bytes16 private constant ONE = 0x3fff0000000000000000000000000000;
    bytes16 private constant TWO = 0x40000000000000000000000000000000;

    function computeEscrow(uint amount, uint strike)
        internal
        pure
        returns (uint)
    {
        return strike.mul(amount);
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
       bytes16[7] memory coef,
       bytes16[2] memory points
    ) internal pure returns (bytes16){
        bytes16 iPlusC1 = coef[0].add(coef[1]);
        bytes16 c2PlusC3 = coef[2].mul(points[0]).add(coef[3].mul(points[1]));
        bytes16 c4PlusC5 = coef[4].mul(points[0].mul(points[0])).add(coef[5].mul(points[0]).mul(points[1]));
        return iPlusC1.add(c2PlusC3).add(c4PlusC5).add(coef[6].mul(points[1].mul(points[1])));
    }
}
