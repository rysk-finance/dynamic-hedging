pragma solidity >=0.8.0;

contract Protocol {

    address public optionRegistry;
    address public priceFeed;

    constructor(
       address _optionRegistry,
       address _priceFeed
    ) public {
        optionRegistry = _optionRegistry;
        priceFeed = _priceFeed;
    }
}
