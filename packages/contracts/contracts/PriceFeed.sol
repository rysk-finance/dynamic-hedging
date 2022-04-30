// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "./interfaces/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "./interfaces/AggregatorV3Interface.sol";

contract PriceFeed is Ownable {
    using PRBMathUD60x18 for uint8;
    using PRBMathSD59x18 for int256;
    using PRBMathUD60x18 for uint256;

    /////////////////////////////////////
    /// governance settable variables ///
    /////////////////////////////////////

    mapping(address => mapping(address => address)) public priceFeeds;

    //////////////////////////
    /// constant variables ///
    //////////////////////////
    
    uint8 private constant SCALE_DECIMALS = 18;

    constructor() {}

   ///////////////
   /// setters ///
   ///////////////

    function addPriceFeed(
        address underlying,
        address strike,
        address feed
    ) public onlyOwner {
        priceFeeds[underlying][strike] = feed;
    }

  ///////////////////////
  /// complex getters ///
  ///////////////////////

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
        uint8 difference;
        if (SCALE_DECIMALS > feedDecimals) {
            difference = SCALE_DECIMALS - feedDecimals;
            return uint(rate) * (10**difference);
        }
        difference = feedDecimals - SCALE_DECIMALS;
        return uint(rate) / (10**difference);
    }
}
