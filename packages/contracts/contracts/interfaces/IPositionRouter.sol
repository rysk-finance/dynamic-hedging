// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

interface IPositionRouter {
	function createIncreasePosition(
		address[] memory _path,
		address _indexToken,
		uint256 _amountIn,
		uint256 _minOut,
		uint256 _sizeDelta,
		bool _isLong,
		uint256 _acceptablePrice,
		uint256 _executionFee,
		bytes32 _referralCode,
		address _callbackTarget
	) external payable returns (bytes32);

	function executeIncreasePosition(bytes32 _key, address payable _executionFeeReceiver)
		external
		returns (bool);

	function minExecutionFee() external view returns (uint256);

	function isLeverageEnabled() external view returns (bool);
}
