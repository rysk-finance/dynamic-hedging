// SPDX-License-Identifier: MIT

pragma solidity >=0.8.9;

abstract contract RewardsDistributionRecipient {
    address public rewardsDistribution;

    function notifyRewardAmount(uint256 reward) virtual external;

    modifier onlyRewardsDistribution() {
        require(msg.sender == rewardsDistribution, "Caller is not RewardsDistribution contract");
        _;
    }
}
