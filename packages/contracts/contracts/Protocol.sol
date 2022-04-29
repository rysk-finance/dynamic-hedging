pragma solidity >=0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import { Types } from "./libraries/Types.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "./libraries/SafeTransferLib.sol";
import "./interfaces/IProtocol.sol";

contract Protocol is IProtocol, Ownable {
    using PRBMathUD60x18 for uint256;
    ////////////////////////
    /// static variables ///
    ////////////////////////

    Core private core;

    /////////////////////////////////////
    /// governance settable variables ///
    /////////////////////////////////////

    // riskFreeRate as a percentage PRBMath Float. IE: 3% -> 0.03 * 10**18
    uint public riskFreeRate;
    // The spread between the bid and ask on the IV skew;
    // Consider making this it's own volatility skew if more flexibility is needed
    uint public bidAskIVSpread;
    // buffer of funds to not be used to write new options in case of margin requirements (as percentage - for 20% enter 2000)
    uint public bufferPercentage = 2000;
    // max total supply of the lp shares
    uint public maxTotalSupply = type(uint256).max;
    // Maximum discount that an option tilting factor can discount an option price
    uint public maxDiscount = PRBMathUD60x18.SCALE.div(10); // As a percentage. Init at 10%
    // addresses that are whitelisted to sell options back to the protocol
    mapping(address => bool) public buybackWhitelist;
    // settings for the limits of a custom order
    Types.CustomOrderBounds public customOrderBounds = Types.CustomOrderBounds(0, 25e16, -25e16, 0, 1000);
    // option issuance parameters
    Types.OptionParams public optionParams;
    // max time to allow between oracle updates
    uint256 public maxTimeDeviationThreshold;
    // max price difference to allow between oracle updates
    uint256 public maxPriceDeviationThreshold;

    constructor(
       address _optionRegistry,
       address _priceFeed,
       address _volatilityFeed,
       address _portfolioValuesFeed
    ) public {
        core = Core(_optionRegistry, _priceFeed, _volatilityFeed, _portfolioValuesFeed);
    }

    ///////////////
    /// setters ///
    ///////////////

    function changeVolatilityFeed(address _volFeed) external onlyOwner {
        core.volatilityFeed = _volFeed;
    }

    function changePortfolioValuesFeed(address _portfolioValuesFeed) external onlyOwner {
        core.portfolioValuesFeed = _portfolioValuesFeed;
    }

    function addOrRemoveBuybackAddress(address _addressToWhitelist, bool toAdd) external onlyOwner {
    buybackWhitelist[_addressToWhitelist] = toAdd;
    }
    function setMaxTimeDeviationThreshold(uint256 _maxTimeDeviationThreshold) external onlyOwner {
        maxTimeDeviationThreshold = _maxTimeDeviationThreshold;
    }
    function setMaxPriceDeviationThreshold(uint256 _maxPriceDeviationThreshold) external onlyOwner {
        maxPriceDeviationThreshold = _maxPriceDeviationThreshold;
    }

    /**
    * @notice set new custom order parameters
    * @param _callMinDelta the minimum delta value a sold custom call option can have (e18 format - for 0.05 enter 5e16). Must be positive or 0.
    * @param _callMaxDelta the maximum delta value a sold custom call option can have. Must be positive and have greater magnitude than _callMinDelta.
    * @param _putMinDelta the minimum delta value a sold custom put option can have. Must be negative and have greater magnitude than _putMaxDelta
    * @param _putMaxDelta the maximum delta value a sold custom put option can have. Must be negative or 0.
    * @param _maxPriceRange the max percentage below the LP calculated premium that the order may be sold for. Measured in BPS - for 10% enter 1000
    */
    function setCustomOrderBounds (   
        uint128 _callMinDelta,
        uint128 _callMaxDelta,
        int128 _putMinDelta,
        int128 _putMaxDelta,
        uint32 _maxPriceRange
    ) onlyOwner external {
        customOrderBounds = Types.CustomOrderBounds({
            callMinDelta: _callMinDelta,
            callMaxDelta: _callMaxDelta,
            putMinDelta: _putMinDelta,
            putMaxDelta: _putMaxDelta,
            maxPriceRange: _maxPriceRange
        });
    }
    /**
        * @notice update all optionParam variables
        */
    function setNewOptionParams(
        uint128 _newMinCallStrike,
        uint128 _newMaxCallStrike,
        uint128 _newMinPutStrike,
        uint128 _newMaxPutStrike,
        uint128 _newMinExpiry,
        uint128 _newMaxExpiry
        ) external onlyOwner {
        optionParams = Types.OptionParams({
            minCallStrikePrice: _newMinCallStrike,
            maxCallStrikePrice: _newMaxCallStrike,
            minPutStrikePrice: _newMinPutStrike,
            maxPutStrikePrice: _newMaxPutStrike,
            minExpiry: _newMinExpiry,
            maxExpiry: _newMaxExpiry
        });
    }
    /**
    * @notice set the bid ask spread used to price option buying
    * @param _bidAskSpread the bid ask spread to update to
    */
    function setBidAskSpread(uint256 _bidAskSpread) external onlyOwner {
        bidAskIVSpread = _bidAskSpread;
    }
    /**
    * @notice set the maximum percentage discount for an option
    * @param _maxDiscount of the option as a percentage in 1e18 format. ie: 1*e18 == 1%
    * @dev   only governance can call this function
    */
    function setMaxDiscount(uint256 _maxDiscount) external onlyOwner {
        maxDiscount = _maxDiscount;
    }
    /**
    * @notice set the maximum share supply of the pool
    * @param _maxTotalSupply of the shares
    * @dev   only governance can call this function
    */
    function setMaxTotalSupply(uint256 _maxTotalSupply) external onlyOwner {
        maxTotalSupply = _maxTotalSupply;
    }
    /**
    * @notice update the liquidity pool buffer limit
    * @param _bufferPercentage the minimum balance the liquidity pool must have as a percentage of total NAV. (for 20% enter 2000)
    */
    function setBufferPercentage(uint _bufferPercentage) external onlyOwner {
        bufferPercentage = _bufferPercentage;
    }
    /**
    * @notice update the liquidity pool risk free rate
    * @param _riskFreeRate the risk free rate of the market
    */
    function setRiskFreeRate(uint _riskFreeRate) external onlyOwner {
        riskFreeRate = _riskFreeRate;
    }

    ///////////////
    /// getters ///
    ///////////////

    function getCustomOrderBounds() external view returns (Types.CustomOrderBounds memory){
        return customOrderBounds;
    }

    function getOptionParams() external view returns (Types.OptionParams memory){
        return optionParams;
    }

    function getCore() external view returns (Core memory){
        return core;
    }
}

