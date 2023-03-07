// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

interface IOracle {
	function getPrice(address _asset) external view returns (uint256);

	function getExpiryPrice(address _asset, uint256 _expiryTimestamp)
		external
		view
		returns (uint256, bool);

	function isLockingPeriodOver(address _asset, uint256 _expiryTimestamp)
		external
		view
		returns (bool);
}
