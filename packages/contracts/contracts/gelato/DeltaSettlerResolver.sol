// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "../AlphaPortfolioValuesFeed.sol";
import "./DeltaSettlerMulticall.sol";

// import {MarginVault} from "../libs/MarginVault.sol";

contract OpynPricerResolver {
	uint256 constant expiryHour = 8;
	uint256 constant secondsPerHour = 3600;
	uint256 constant secondsPerDay = secondsPerHour * 24;

	AlphaPortfolioValuesFeed constant pvFeed =
		AlphaPortfolioValuesFeed(0x7f9d820CFc109686F2ca096fFA93dd497b91C073);
	DeltaSettlerMulticall constant deltaSellterMulticall = DeltaSettlerMulticall();

	constructor(address _addressBook) {
		addressBook = IAddressBook(_addressBook);
	}

	function checker() external view returns (bool canExec, bytes memory execPayload) {
		uint256 currentTimestamp = block.timestamp;

		// if current time is not between 8 and 9am, do not execute.
		if (
			currentTimestamp % secondsPerDay < secondsPerHour * expiryHour ||
			currentTimestamp % secondsPerDay > secondsPerHour * (expiryHour + 1)
		) {
			return (false, bytes("Incorrect time"));
		}

		address[] series = pvFeed.getAddressSet();
		address[] vaultsToSettle = deltaSettlerMulticall.checkVaultsToSettle(series);

		if (vaultsToSettle.length) {
			return (true, abi.encodeCall(DeltaSettlerMulticall.settleVaults, (vaultsToSettle)));
		} else {
			return (false, bytes("No vaults to settle"));
		}
	}
}
