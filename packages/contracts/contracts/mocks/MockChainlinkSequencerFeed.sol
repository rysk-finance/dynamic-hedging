/**
 * SPDX-License-Identifier: UNLICENSED
 */
pragma solidity 0.8.9;

/**
 * @notice Chainlink oracle mock
 */
contract MockChainlinkSequencerFeed {
	uint256 public decimals = 8;

	/// @dev mock sequencer status answer: 0 is up, 1 is down.
	int256 internal answer;
	/// @dev mock timestamp when sequencer came back up
	uint256 internal startedAt;

	/// @dev function to mock sequencer status. only answer and startedAt needed.
	function latestRoundData()
		external
		view
		returns (
			uint80,
			int256,
			uint256,
			uint256,
			uint80
		)
	{
		return (1, answer, startedAt, 1, 1);
	}

	/// @dev function to mock setting time sequencer came back up
	function setStartedAt(uint256 _startedAt) external {
		startedAt = _startedAt;
	}

	/// @dev function to mock setting sequencer online status
	function setAnswer(int256 _answer) external {
		answer = _answer;
	}
}
