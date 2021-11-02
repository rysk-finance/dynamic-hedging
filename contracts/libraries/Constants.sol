pragma solidity >=0.8.0;

library Constants {
    address private constant ETH = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    // 10**18
    bytes16 private constant DECIMAL_PLACE = 0x403abc16d674ec800000000000000000;

    function ethAddress() public pure returns (address) {
        return ETH;
    }

    function decimalPlace() public pure returns (bytes16) {
        return DECIMAL_PLACE;
    }
}
