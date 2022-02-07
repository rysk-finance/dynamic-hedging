pragma solidity >=0.8.9;

import { BlackScholes } from "../libraries/BlackScholes.sol";
import { Types } from "../Types.sol";

contract BlackScholesTest {
    function retBlackScholesCalc(uint price, uint strike, uint expiration, uint vol, uint rfr, uint8 flavor) public view returns(uint) {
        Types.Flavor optionType = Types.Flavor(flavor); 
        return BlackScholes.blackScholesCalc(price, strike, expiration, vol, rfr, optionType);
    }

    function getDelta(uint price, uint strike, uint expiration, uint vol, uint rfr, uint8 flavor) public view returns(int) {
        Types.Flavor optionType = Types.Flavor(flavor); 
        return BlackScholes.getDelta(price, strike, expiration, vol, rfr, optionType);
    }
}