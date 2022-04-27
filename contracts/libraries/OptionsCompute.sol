pragma solidity >=0.8.0;

import "prb-math/contracts/PRBMathUD60x18.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "./Types.sol";
import "../tokens/ERC20.sol";

error DecimalIsLargerThanScale(uint256 decimals);
library OptionsCompute {
    using PRBMathUD60x18 for uint256;
    using PRBMathSD59x18 for int256;

    uint8 private constant SCALE_DECIMALS = 18;

    /// @dev assumes decimals are coming in as e18
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
    
    function convertToCollateralDenominated(uint quote, uint underlyingPrice, Types.OptionSeries memory optionSeries) internal pure returns(uint convertedQuote){
        if(optionSeries.strikeAsset != optionSeries.collateral){
            // convert value from strike asset to collateral asset
            return quote * 1e18 / underlyingPrice;
        } else {
            return quote;
        }
    }

    /** 
     @dev computes the percentage difference between two integers
     @param a the smaller integer
     @param b the larger integer
     @return uint256 the percentage differnce
    */
    function calculatePercentageDifference(
        uint256 a,
        uint256 b
    ) internal pure returns (uint256) {
        if (a > b) {
            return b.div(a);
        }
        return a.div(b);
    }

 /**
   * @notice function to return absolute value of an input
   * @param  x value to check
   * @return absolute value to return
   */
  function abs(int256 x) internal pure returns (int256) {
    return x >= 0 ? x : -x;
  }
}
