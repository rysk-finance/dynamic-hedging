pragma solidity >=0.8.9;

import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import { OptionsCompute } from "./libraries/OptionsCompute.sol";

contract VolatilityFeed is Ownable {

    using PRBMathSD59x18 for int256;
    using PRBMathUD60x18 for uint256;
    
    uint256 private constant ONE_YEAR_SECONDS = 31557600;
    // skew parameters for calls
    int[7] public callsVolatilitySkew;
    // skew parameters for puts
    int[7] public putsVolatilitySkew;
    constructor() public {}

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
      return uint(OptionsCompute.computeIVFromSkew(coef, points));
    }

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
}
