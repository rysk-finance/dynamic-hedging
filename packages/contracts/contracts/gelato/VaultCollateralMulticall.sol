// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

import "../../contracts/OptionRegistry.sol";
import "../libraries/AccessControl.sol";

contract VaultCollateralMulticall is AccessControl {
	/// @notice address of the keeper of this pool
	mapping(address => bool) public keeper;
	OptionRegistry public optionRegistry;
	uint256 private constant UPPER_HF_BUFFER = 11_000;
	uint256 private constant MAX_BPS = 10_000;

	error invalidMsgSender();

	constructor(address _authority, address _optionRegistry) AccessControl(IAuthority(_authority)) {
		optionRegistry = OptionRegistry(_optionRegistry);
	}

	/// @notice update the keepers
	function setKeeper(address _keeper, bool _auth) external {
		_onlyGovernor();
		keeper[_keeper] = _auth;
	}

	function checkVaults(uint256[] calldata vaultIds) external view returns (uint256[] memory) {
		// create fixed length dynamic memory array to return
		uint256[] memory unhealthyVaults = new uint256[](vaultIds.length);
		uint256 i = 0;
		uint256 length = vaultIds.length;
		for (i; i < length; i++) {
			try optionRegistry.checkVaultHealth(vaultIds[i]) returns (
				bool isBelowMin,
				bool isAboveMax,
				uint256 healthFactor,
				uint256 upperHealthFactor,
				uint256 collatRequired,
				address collatAsset
			) {
				if (
					isBelowMin || (isAboveMax && healthFactor > ((UPPER_HF_BUFFER * upperHealthFactor) / MAX_BPS))
				) {
					// fill with vault ID if it needs adjusting
					unhealthyVaults[i] = vaultIds[i];
				} else {
					// fill with zero if it does not need adjusting (vault ID zero does not exist)
					unhealthyVaults[i] = 0;
				}
			} catch {
				unhealthyVaults[i] = 0;
			}
		}
		return unhealthyVaults;
	}

	function adjustVaults(uint256[] calldata vaultIds) external {
		_isKeeper();

		uint256 i = 0;
		uint256 length = vaultIds.length;
		for (i; i < length; i++) {
			try optionRegistry.adjustCollateral(vaultIds[i]) {} catch {}
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
