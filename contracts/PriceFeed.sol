pragma solidity >=0.8.9;

import "./tokens/UniversalERC20.sol";
import "./access/Ownable.sol";
import "./interfaces/AggregatorV3Interface.sol";
import "./interfaces/IERC20.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";

contract PriceFeed is Ownable {

    mapping(address => mapping(address => address)) public priceFeeds;

    using UniversalERC20 for IERC20;
    using PRBMathUD60x18 for uint8;
    using PRBMathSD59x18 for int256;
    using PRBMathUD60x18 for uint256;
    uint8 private constant SCALE_DECIMALS = 18;

    constructor() public {}

    function addPriceFeed(
        address underlying,
        address strike,
        address feed
    ) public onlyOwner {
        priceFeeds[underlying][strike] = feed;
    }

    function getRate(
        address underlying,
        address strike
    ) public view returns(uint) {
        address feedAddress = priceFeeds[underlying][strike];
        //TODO attempt path through ETH
        require(feedAddress != address(0), "Price feed does not exist");
        AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
        (, int rate,,,) = feed.latestRoundData();
        return uint(rate);
    }

    function getNormalizedRate(
       address underlying,
       address strike
    ) external view returns(uint) {
        address feedAddress = priceFeeds[underlying][strike];
        //TODO attempt path through ETH
        require(feedAddress != address(0), "Price feed does not exist");
        AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
        uint8 feedDecimals = feed.decimals();
        (, int rate,,,) = feed.latestRoundData();
        if (SCALE_DECIMALS > feedDecimals) {
            uint8 difference = SCALE_DECIMALS - feedDecimals;
            return uint(rate) * (10**difference);
        }
        uint8 difference = feedDecimals - SCALE_DECIMALS;
        return uint(rate) / (10**difference);
    }
}
