// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "../interfaces/IAlphaPortfolioValuesFeed.sol";
import "./DeltaSettlerMulticall.sol";
import "hardhat/console.sol";

contract DeltaSettlerResolver {
	uint256 constant expiryHour = 8;
	uint256 constant secondsPerHour = 3600;
	uint256 constant secondsPerDay = secondsPerHour * 24;

	DeltaSettlerMulticall public immutable deltaSettlerMulticall;
	IAlphaPortfolioValuesFeed public immutable pvFeed;

	constructor(address _multicall, address _pvFeed) {
		deltaSettlerMulticall = DeltaSettlerMulticall(_multicall);
		pvFeed = IAlphaPortfolioValuesFeed(_pvFeed);
	}

	function checker() external view returns (bool canExec, bytes memory execPayload) {
		uint256 currentTimestamp = block.timestamp;
		console.log("current timestamp", currentTimestamp);
		// if current time is not between 8 and 9am, do not execute.
		if (
			currentTimestamp % secondsPerDay < secondsPerHour * expiryHour ||
			currentTimestamp % secondsPerDay > secondsPerHour * (expiryHour + 1)
		) {
			return (false, bytes("Incorrect time"));
		}

		address[] memory series = pvFeed.getAddressSet();
		console.log("length:", series.length);
		(address[] memory vaultsToSettle, bool needsToExecute) = deltaSettlerMulticall
			.checkVaultsToSettle(series);
		if (needsToExecute) {
			console.log("vaults to settle length:", vaultsToSettle.length);
			return (
				true,
				abi.encodeWithSelector(DeltaSettlerMulticall.settleVaults.selector, (vaultsToSettle))
			);
		} else {
			return (false, bytes("No vaults to settle"));
		}
	}
}
