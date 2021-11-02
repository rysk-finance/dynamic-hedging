pragma solidity >=0.8.0;

contract Protocol {

    address public optionRegistry;
    address public liquidityPools;
    address public priceFeed;

    constructor(
       address _optionRegistry,
       address _liquidityPools,
       address _priceFeed
    ) public {
        optionRegistry = _optionRegistry;
        liquidityPools = _liquidityPools;
        priceFeed = _priceFeed;
    }
}
