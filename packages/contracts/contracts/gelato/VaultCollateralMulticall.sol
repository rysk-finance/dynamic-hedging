// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "../../contracts/OptionRegistry.sol";

contract VaultCollateralMulticall {
	address executorAddress;
	OptionRegistry optionRegistry;

	error invalidMsgSender();

	constructor(address _executorAddress, address _optionRegistry) {
		executorAddress = _executorAddress;
		optionRegistry = OptionRegistry(_optionRegistry);
	}

	function adjustVaults(uint256[] calldata vaultIds) external {
		if (msg.sender != executorAddress) {
			revert invalidMsgSender();
		}

		uint256 i = 0;
		for (i; i < vaultIds.length; i++) {
			try optionRegistry.adjustCollateral(vaultIds[i]) {} catch {}
		}
	}
}
