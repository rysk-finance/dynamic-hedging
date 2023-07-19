// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "../interfaces/IAlphaPortfolioValuesFeed.sol";
import "./DeltaSettlerMulticall.sol";

contract DeltaSettlerResolver {
	uint256 constant expiryHour = 8;
	uint256 constant secondsPerHour = 3600;
	uint256 constant secondsPerDay = secondsPerHour * 24;

	IAlphaPortfolioValuesFeed constant pvFeed =
		IAlphaPortfolioValuesFeed(0x7f9d820CFc109686F2ca096fFA93dd497b91C073);
	DeltaSettlerMulticall constant deltaSettlerMulticall =
		DeltaSettlerMulticall(0x0000000000000000000000000000000000000000); //TODO CHANGE THIS TO DEPLOYED ADDRESS

	function checker() external view returns (bool canExec, bytes memory execPayload) {
		uint256 currentTimestamp = block.timestamp;

		// if current time is not between 8 and 9am, do not execute.
		if (
			currentTimestamp % secondsPerDay < secondsPerHour * expiryHour ||
			currentTimestamp % secondsPerDay > secondsPerHour * (expiryHour + 1)
		) {
			return (false, bytes("Incorrect time"));
		}

		address[] memory series = pvFeed.getAddressSet();
		address[] memory vaultsToSettle = deltaSettlerMulticall.checkVaultsToSettle(series);

		if (vaultsToSettle.length > 0) {
			return (
				true,
				abi.encodeWithSelector(DeltaSettlerMulticall.settleVaults.selector, (vaultsToSettle))
			);
		} else {
			return (false, bytes("No vaults to settle"));
		}
	}
}
