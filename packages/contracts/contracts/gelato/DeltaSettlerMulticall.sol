// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "../../contracts/LiquidityPool.sol";
import { GammaTypes, IController } from "../interfaces/GammaInterface.sol";
import "../OptionRegistry.sol";

contract DeltaSettlerMulticall {
	address public executorAddress;
	address optionRegistryAddress = 0x8Bc23878981a207860bA4B185fD065f4fd3c7725;
	OptionRegistry constant optionRegistry =
		OptionRegistry(0x8Bc23878981a207860bA4B185fD065f4fd3c7725);
	IController constant controller = IController(0x594bD4eC29F7900AE29549c140Ac53b5240d4019);
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
	) external view returns (address[] memory) {
		// create fixed length dynamic memory array to return
		address[] memory vaultsToSettle = new address[](seriesAddresses.length);
		uint256 i = 0;
		uint256 length = seriesAddresses.length;

		for (i; i < length; i++) {
			uint vaultId = optionRegistry.vaultIds(seriesAddresses[i]);
			GammaTypes.Vault memory vault = controller.getVault(optionRegistryAddress, vaultId);
			if ((controller.isSettlementAllowed(seriesAddresses[i])) && vault.shortAmounts[0] > 0) {
				vaultsToSettle[i] = seriesAddresses[i];
			}
		}
		return vaultsToSettle;
	}

	function settleVaults(address[] calldata seriesAddresses) external {
		if (msg.sender != executorAddress) {
			revert invalidMsgSender();
		}

		uint256 i = 0;
		uint256 length = seriesAddresses.length;
		for (i; i < length; i++) {
			try liquidityPool.settleVault(seriesAddresses[i]) {} catch {}
		}
	}
}
