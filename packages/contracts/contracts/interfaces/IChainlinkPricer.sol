// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

interface IChainlinkPricer {
	function setExpiryPriceInOracle(uint256 _expiryTimestamp, uint80 _roundId) external;
}
