// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "../../contracts/LiquidityPool.sol";
import { GammaTypes, IController } from "../interfaces/GammaInterface.sol";
import "../OptionRegistry.sol";

contract DeltaSettlerMulticall {
	address public executorAddress;
	address public immutable optionRegistryAddress;
	OptionRegistry public immutable optionRegistry;
	IController public immutable controller;
	LiquidityPool public immutable liquidityPool;

	error invalidMsgSender();

	constructor(
		address _executorAddress,
		address _optionRegistryAddress,
		address _controllerAddres,
		address _liquidityPoolAddress
	) {
		executorAddress = _executorAddress;
		optionRegistryAddress = _optionRegistryAddress;
		optionRegistry = OptionRegistry(_optionRegistryAddress);
		controller = IController(_controllerAddres);
		liquidityPool = LiquidityPool(_liquidityPoolAddress);
	}

	function setExecutor(address _executorAddress) external {
		if (msg.sender != executorAddress) {
			revert invalidMsgSender();
		}
		executorAddress = _executorAddress;
	}

	function checkVaultsToSettle(
		address[] calldata seriesAddresses
	) external view returns (address[] memory, bool) {
		// create fixed length dynamic memory array to return
		address[] memory vaultsToSettle = new address[](seriesAddresses.length);
		uint256 i = 0;
		uint256 length = seriesAddresses.length;

		// will return false if no vaults need settling otherwise will return true
		bool needsToExecute = false;

		for (i; i < length; i++) {
			uint vaultId = optionRegistry.vaultIds(seriesAddresses[i]);
			GammaTypes.Vault memory vault = controller.getVault(optionRegistryAddress, vaultId);
			if (vault.shortAmounts.length == 0) {
				continue;
			}
			if ((controller.isSettlementAllowed(seriesAddresses[i])) && vault.shortAmounts[0] > 0) {
				vaultsToSettle[i] = seriesAddresses[i];
				needsToExecute = true;
			} else {
				vaultsToSettle[i] = address(0);
			}
		}
		return (vaultsToSettle, needsToExecute);
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
