pragma solidity >=0.8.9;
import "./interfaces/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";
import "./interfaces/AggregatorV3Interface.sol";

contract DeltaFeed is Ownable {

    mapping(address => mapping(address => address)) public deltaFeeds;
    using PRBMathUD60x18 for uint8;
    using PRBMathSD59x18 for int256;
    using PRBMathUD60x18 for uint256;
    uint8 private constant SCALE_DECIMALS = 18;

    constructor() public {}

    function addDeltaFeed(
        address underlying,
        address strike,
        address feed
    ) public onlyOwner {
        deltaFeeds[underlying][strike] = feed;
    }

    function getDelta(
        address underlying,
        address strike
    ) public view returns(int) {
        address feedAddress = deltaFeeds[underlying][strike];
        require(feedAddress != address(0), "Price feed does not exist");
        //@TODO check with node operators if they want to use V3 interface
        AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
        (, int delta,,,) = feed.latestRoundData();
        return delta;
    }

    // @TODO implement after disucssion with node operators
    function requestUpdate(
        address underlying,
        address strike
    ) public view {}
}
