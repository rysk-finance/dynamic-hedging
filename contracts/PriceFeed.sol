pragma solidity >=0.8.9;

import "./tokens/UniversalERC20.sol";
import "./access/Ownable.sol";
import "./interfaces/AggregatorV3Interface.sol";
import "./interfaces/IERC20.sol";
import "./math/SafeMath.sol";
import "hardhat/console.sol";

contract PriceFeed is Ownable {

    mapping(address => mapping(address => address)) public priceFeeds;

    using UniversalERC20 for IERC20;
    using SafeMath for uint8;
    using SafeMath for uint;

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
        IERC20 strikeToken = IERC20(strike);
        //TODO attempt path through ETH
        require(feedAddress != address(0), "Price feed does not exist");
        AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
        uint8 feedDecimals = feed.decimals();
        uint8 strikeDecimals = strikeToken.decimals();
        (, int rate,,,) = feed.latestRoundData();
        uint exponent = strikeDecimals.sub(feedDecimals);
        uint normalized = uint(rate).mul(10**(exponent));
        return normalized;
    }
}
