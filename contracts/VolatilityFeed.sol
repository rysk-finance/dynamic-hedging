pragma solidity >=0.8.9;

import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import { OptionsCompute } from "./libraries/OptionsCompute.sol";

contract VolatilityFeed is Ownable {
    using PRBMathSD59x18 for int256;
    using PRBMathUD60x18 for uint256;

    /////////////////////////////////////
    /// governance settable variables ///
    /////////////////////////////////////

    // skew parameters for calls
    int[7] public callsVolatilitySkew;
    // skew parameters for puts
    int[7] public putsVolatilitySkew;

    //////////////////////////
    /// constant variables ///
    //////////////////////////
    
    // number of seconds in a year used for calculations
    uint256 private constant ONE_YEAR_SECONDS = 31557600;
    constructor() public {}

   ///////////////
   /// setters ///
   ///////////////

  /**
   * @notice set the volatility skew of the pool
   * @param values the parameters of the skew
   * @param isPut the option type, put or call?
   * @dev   only governance can call this function
   */
  function setVolatilitySkew(int[7] calldata values, bool isPut)
      onlyOwner
      external
  {
      if (!isPut) {
          callsVolatilitySkew = values;
      } else {
          putsVolatilitySkew = values;
      }
  }

    
  ///////////////////////
  /// complex getters ///
  ///////////////////////

  /**
   * @notice get the current implied volatility from the feed
   * @param isPut Is the option a call or put?
   * @param underlyingPrice The underlying price 
   * @param strikePrice The strike price of the option
   * @param expiration expiration timestamp of option as a PRBMath Float
   * @return Implied volatility adjusted for volatility surface
   */
  function getImpliedVolatility(
    bool isPut,
    uint underlyingPrice,
    uint strikePrice,
    uint expiration
  ) public view returns(uint) {
      uint256 time = (expiration - block.timestamp).div(ONE_YEAR_SECONDS);
      int underlying = int(underlyingPrice);
      int spot_distance = (int(strikePrice) - int(underlying)).div(underlying);
      int[2] memory points = [spot_distance, int(time)];
      int[7] memory coef = isPut ? putsVolatilitySkew : callsVolatilitySkew;
      return uint(computeIVFromSkew(coef, points));
    }
  /**
   * @notice get the volatility skew of the pool
   * @param isPut the option type, put or call?
   * @return the skew parameters
   */
  function getVolatilitySkew(bool isPut)
      external
      view
      returns (int[7] memory)
  {
      if (!isPut) {
          return callsVolatilitySkew;
      } else {
          return putsVolatilitySkew;
      }
  }

    //////////////////////////
    /// internal utilities ///
    //////////////////////////

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
