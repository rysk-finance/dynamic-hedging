pragma solidity >=0.8.9;

import "../interfaces/IERC20.sol";
import "./SafeERC20.sol";

// @Author Anton Bukov - https://github.com/k06a
library UniversalERC20 {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 private constant ZERO_ADDRESS = IERC20(0x0000000000000000000000000000000000000000);
    IERC20 private constant ETH_ADDRESS = IERC20(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    function universalTransfer(IERC20 token, address to, uint256 amount) internal returns(bool) {
        if (amount == 0) {
            return true;
        }

        if (token == ZERO_ADDRESS || token == ETH_ADDRESS) {
            payable(address(uint160(to))).transfer(amount);
        } else {
            token.safeTransfer(to, amount);
            return true;
        }
    }

    function universalTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        if (amount == 0) {
            return;
        }

        if (token == ZERO_ADDRESS || token == ETH_ADDRESS) {
            require(from == msg.sender && msg.value >= amount, "msg.value is less than amount");
            if (to != address(this)) {
                payable(address(uint160(to))).transfer(amount);
            }
            if (msg.value > amount) {
                payable(msg.sender).transfer(msg.value.sub(amount));
            }
        } else {
            require(msg.value == 0, "msg.value should be zero");
            token.safeTransferFrom(from, to, amount);
        }
    }

    function universalApprove(IERC20 token, address to, uint256 amount) internal {
        if (token != ZERO_ADDRESS && token != ETH_ADDRESS) {
            token.safeApprove(to, amount);
        }
    }

    function universalBalanceOf(IERC20 token, address who) internal view returns (uint256) {
        if (token == ZERO_ADDRESS || token == ETH_ADDRESS) {
            return who.balance;
        } else {
            return token.balanceOf(who);
        }
    }

    function universalDecimals(IERC20 token) internal view returns (uint256) {

        if (token == ZERO_ADDRESS || token == ETH_ADDRESS) {
            return 18;
        }

        (bool success, bytes memory data) = address(token).staticcall{gas:5000}(
            abi.encodeWithSignature("decimals()")
        );
        if (!success) {
            (success, data) = address(token).staticcall{gas:5000}(
                abi.encodeWithSignature("DECIMALS()")
            );
        }

        return success ? abi.decode(data, (uint256)) : 18;
    }

    function isETH(IERC20 token) internal pure returns(bool) {
        return (address(token) == address(ZERO_ADDRESS) || address(token) == address(ETH_ADDRESS));
    }
}
