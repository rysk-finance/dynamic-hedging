pragma solidity >=0.8.0;

contract Protocol {

    address public optionRegistryV2;
    address public priceFeed;

    constructor(
       address _optionRegistryV2,
       address _priceFeed
    ) public {
        optionRegistryV2 = _optionRegistryV2;
        priceFeed = _priceFeed;
    }
}
