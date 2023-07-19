// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "../../contracts/LiquidityPool.sol";
import "../packages/opyn/new/NewController.sol";
import "../OptionRegistry.sol";

contract DeltaSettlerMulticall {
	address public executorAddress;

	NewController constant controller = NewController(0x594bD4eC29F7900AE29549c140Ac53b5240d4019);
	OptionRegistry constant optionRegistry =
		OptionRegistry(0x8Bc23878981a207860bA4B185fD065f4fd3c7725);
	LiquidityPool constant liquidityPool = LiquidityPool(0x217749d9017cB87712654422a1F5856AAA147b80);

	error invalidMsgSender();

	constructor(address _executorAddress) {
		executorAddress = _executorAddress;
	}

	function setExecutor(address _executorAddress) external {
		if (msg.sender != executorAddress) {
			revert invalidMsgSender();
		}
		executorAddress = _executorAddress;
	}

	function checkVaultsToSettle(
		address[] calldata seriesAddresses
	) external view returns (uint256[] memory) {
		// create fixed length dynamic memory array to return
		uint256[] memory vaultsToSettle = new uint256[](seriesAddress.length);
		uint256 i = 0;
		uint256 length = seriesAddresses.length;

		for (uint i = 0; i < length; i++) {
			uint vaultId = optionRegistry.vaultIds(seriesAddresses[i]);
			MarginVault.Vault vault = controller.getVault(optionRegistryAddress, vaultId);
			if ((controller.isSettlementAllowed(seriesAddresses[i])) && vault.shortAmounts[0] > 0) {
				vaultsToSettle.push(seriesAddresses[i]);
			}
		}
		return vaultsToSettle;
	}

	function settleVaults(address[] calldata seriesAddresses) external {
		if (msg.sender != executorAddress) {
			revert invalidMsgSender();
		}

		uint256 i = 0;
		uint256 length = seriesAddress.length;
		for (i; i < length; i++) {
			try liquidityPool.settleVault(seriesAddresses[i]) {} catch {}
		}
	}
}
