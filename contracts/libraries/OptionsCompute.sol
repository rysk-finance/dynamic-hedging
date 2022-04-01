pragma solidity >=0.8.0;

import { Constants } from "./Constants.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "../tokens/ERC20.sol";

error DecimalIsLargerThanScale(uint256 decimals);
library OptionsCompute {
    using PRBMathUD60x18 for uint256;
    using PRBMathSD59x18 for int256;

    uint8 private constant SCALE_DECIMALS = 18;

    function convertToDecimals(
        uint value,
        uint decimals
    ) internal pure returns (uint) {
        if (decimals > SCALE_DECIMALS) { revert DecimalIsLargerThanScale(decimals); }
        uint difference = SCALE_DECIMALS - decimals;
        return value / (10**difference);
    }

    function convertFromDecimals(
        uint value,
        uint decimals
    ) internal pure returns (uint) {
        if (decimals > SCALE_DECIMALS) { revert DecimalIsLargerThanScale(decimals); }
        uint difference = SCALE_DECIMALS - decimals;
        return value * (10**difference);
    }

    function computeEscrow(uint amount, uint strike, uint underlyingDecimals)
        internal
        pure
        returns (uint)
    {
        //uint decimalShift = 18 - underlyingDecimals;
        //return strike.mul(amount).div(10**(8 + decimalShift));
        uint escrow = strike.mul(amount);
        return convertToDecimals(escrow, underlyingDecimals);
    }

    /**
        @dev computes new portfolio options position on a given side (put or call). Reduces and represents this position as a single option.
        @param amount the number number of newly written options
        @param strike the strike of the newly written option
        @param expiration expiration date of the new option
        @param totalAmount total amount of active calls/puts
        @param weightedStrike weighted strike price of active calls/puts
        @param weightedTime weighted time to expiry of active calls/puts
        @return newTotalAmount the new total amount of active calls/puts
        @return newWeightedStrike new weighted strike price of active calls/puts
        @return newWeightedTime new weighted time to expiry of active calls/puts
     */
    function computeNewWeights(
       uint amount,
       uint strike,
       uint expiration,
       uint totalAmount,
       uint weightedStrike,
       uint weightedTime, 
       bool isSale
    ) internal pure returns (uint, uint, uint) {
        uint weight = PRBMathUD60x18.scale();
        if (!isSale) {
            if(amount == totalAmount) {
                return (0, 0, 0);
            }
            if (totalAmount > 0) {
                weight = amount.div(totalAmount - amount);
            }
            uint exWeight = PRBMathUD60x18.scale() + weight;
            uint newTotalAmount = totalAmount - amount;
            uint newWeightedStrike = (exWeight.mul(weightedStrike)) - (weight.mul(strike));
            uint newWeightedTime = (exWeight.mul(weightedTime)) - (weight.mul(expiration));
            return (newTotalAmount, newWeightedStrike, newWeightedTime);
        } else {
            if (totalAmount > 0) {
                weight = amount.div(totalAmount + amount);
            }
            uint exWeight = PRBMathUD60x18.scale() - weight;
            uint newTotalAmount = totalAmount + amount;
            uint newWeightedStrike = (exWeight.mul(weightedStrike)) + (weight.mul(strike));
            uint newWeightedTime = (exWeight.mul(weightedTime)) + (weight.mul(expiration));
            return (newTotalAmount, newWeightedStrike, newWeightedTime);      
        }
    }
    

     function computeNewWeightsBuyback(
       uint amount,
       uint strike,
       uint expiration,
       uint totalAmount,
       uint weightedStrike,
       uint weightedTime
    ) internal pure returns (uint, uint, uint) {
        uint weight = PRBMathUD60x18.scale();
        if(amount == totalAmount) {
            return (0, 0, 0);
        }
        if (totalAmount > 0) {
            weight = amount.div(totalAmount - amount);
        }
        uint exWeight = PRBMathUD60x18.scale() + weight;
        uint newTotalAmount = totalAmount - amount;
        uint newWeightedStrike = (exWeight.mul(weightedStrike)) - (weight.mul(strike));
        uint newWeightedTime = (exWeight.mul(weightedTime)) - (weight.mul(expiration));
        return (newTotalAmount, newWeightedStrike, newWeightedTime);
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
