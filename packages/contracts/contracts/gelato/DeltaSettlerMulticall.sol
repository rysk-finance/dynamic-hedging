// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "../../contracts/LiquidityPool.sol";
import { GammaTypes, IController } from "../interfaces/GammaInterface.sol";
import "../OptionRegistry.sol";
import "../libraries/AccessControl.sol";

contract DeltaSettlerMulticall is AccessControl {
	/// @notice address of the keeper of this pool
	mapping(address => bool) public keeper;
	address public immutable optionRegistryAddress;
	OptionRegistry public immutable optionRegistry;
	IController public immutable controller;
	LiquidityPool public immutable liquidityPool;

	error invalidMsgSender();

	constructor(
		address _authority,
		address _optionRegistryAddress,
		address _controllerAddres,
		address _liquidityPoolAddress
	) AccessControl(IAuthority(_authority)) {
		optionRegistryAddress = _optionRegistryAddress;
		optionRegistry = OptionRegistry(_optionRegistryAddress);
		controller = IController(_controllerAddres);
		liquidityPool = LiquidityPool(_liquidityPoolAddress);
	}

	/// @notice update the keepers
	function setKeeper(address _keeper, bool _auth) external {
		_onlyGovernor();
		keeper[_keeper] = _auth;
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
		_isKeeper();

		uint256 i = 0;
		uint256 length = seriesAddresses.length;
		for (i; i < length; i++) {
			try liquidityPool.settleVault(seriesAddresses[i]) {} catch {}
		}
	}

	/// @dev keepers, managers or governors can access
	function _isKeeper() internal view {
		if (
			!keeper[msg.sender] && msg.sender != authority.governor() && msg.sender != authority.manager()
		) {
			revert CustomErrors.NotKeeper();
		}
	}
}
