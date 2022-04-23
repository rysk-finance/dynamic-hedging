pragma solidity >=0.8.9;

import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";

contract Volatility {
    using PRBMathSD59x18 for int256;
    using PRBMathUD60x18 for uint256;

    function computeIVFromSkewInts(
       int[7] memory coef,
       int[2] memory points
    ) public pure returns (int) {
        return computeIVFromSkew(coef, points);
    }

    // @param points[0] spot distance
    // @param points[1] expiration time
    // @param coef degree-2 polynomial features are [intercept, 1, a, b, a^2, ab, b^2]
    // a == spot_distance, b == expiration time
    // spot_distance: (strike - spot_price) / spot_price
    // expiration: years to expiration
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
