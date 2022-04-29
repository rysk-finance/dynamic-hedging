pragma solidity >=0.8.0;

import { Types } from "../libraries/Types.sol";

interface IProtocol  {
    struct Core {
        address optionRegistry;
        address priceFeed;
        address volatilityFeed;
        address portfolioValuesFeed;
    }
    function getCore() external view returns (Core memory);
    // riskFreeRate as a percentage PRBMath Float. IE: 3% -> 0.03 * 10**18
    function riskFreeRate() external view returns(uint);
    // The spread between the bid and ask on the IV skew;
    // Consider making this it's own volatility skew if more flexibility is needed
    function bidAskIVSpread() external view returns(uint);
    // buffer of funds to not be used to write new options in case of margin requirements (as percentage - for 20% enter 2000)
    function bufferPercentage() external view returns(uint);
    // max total supply of the lp shares
    function maxTotalSupply() external view returns(uint);
    // Maximum discount that an option tilting factor can discount an option price
    function maxDiscount()  external view returns(uint); // As a percentage. Init at 10%
    // addresses that are whitelisted to sell options back to the protocol
    function buybackWhitelist(address) external view returns(bool);
    // max time to allow between oracle updates
    function maxTimeDeviationThreshold() external view returns(uint256);
    // max price difference to allow between oracle updates
    function maxPriceDeviationThreshold() external view returns(uint256);
    function getCustomOrderBounds() external view returns (Types.CustomOrderBounds memory);
    function getOptionParams() external view returns (Types.OptionParams memory);
}

