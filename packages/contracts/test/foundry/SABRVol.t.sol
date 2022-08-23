pragma solidity 0.8.10;

import "forge-std/Test.sol";
import "../../contracts/VolatilityFeed.sol";
import "../../contracts/Authority.sol";

contract ContractBTest is Test {
    VolatilityFeed public volFeed;

    function setUp() public {
        Authority auth = new Authority(address(this), msg.sender, msg.sender);
        volFeed = new VolatilityFeed(address(auth));
    }

    function testGetKeeper() public {
        bool isKeeper = volFeed.keeper(msg.sender);
        assertEq(isKeeper, false);
    }

    function testSetKeeper() public {
        volFeed.setKeeper(msg.sender, true);
        bool isKeeper = volFeed.keeper(msg.sender);
        assertEq(isKeeper, true);
    }
}