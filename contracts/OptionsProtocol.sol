pragma solidity >=0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
contract Protocol is Ownable {

    ////////////////////////
    /// static variables ///
    ////////////////////////

    address public optionRegistry;
    address public priceFeed;

    /////////////////////////////////////
    /// governance settable variables ///
    /////////////////////////////////////

    address public volatilityFeed;

    constructor(
       address _optionRegistry,
       address _priceFeed,
       address _volatilityFeed
    ) {
        optionRegistry = _optionRegistry;
        priceFeed = _priceFeed;
        volatilityFeed = _volatilityFeed;
    }

    ///////////////
    /// setters ///
    ///////////////

    function changeVolatilityFeed(address _volFeed) external onlyOwner {
        volatilityFeed = _volFeed;
    }
}

