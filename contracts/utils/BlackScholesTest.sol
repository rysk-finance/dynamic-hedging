pragma solidity >=0.8.9;

import { BlackScholes } from "../libraries/BlackScholes.sol";
import { Types } from "../libraries/Types.sol";

contract BlackScholesTest {
    function retBlackScholesCalc(uint price, uint strike, uint expiration, uint vol, uint rfr, bool isPut) public view returns(uint) { 
        return BlackScholes.blackScholesCalc(price, strike, expiration, vol, rfr, isPut);
    }

    function getDelta(uint price, uint strike, uint expiration, uint vol, uint rfr, bool isPut) public view returns(int) {
        return BlackScholes.getDelta(price, strike, expiration, vol, rfr, isPut);
    }
}