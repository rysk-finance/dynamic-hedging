// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.0;

import "./interfaces/IAuthority.sol";
import "./libraries/CustomErrors.sol";
import "./libraries/AccessControl.sol";

/**
 *  @title Contract used as the source of truth for all protocol authority and access control, based off of OlympusDao Access Control
 */
contract Authority is IAuthority, AccessControl {
	/* ========== STATE VARIABLES ========== */

	address public override governor;

	mapping(address => bool) public override guardian;

	address public override manager;

	address public newGovernor;

	address public newManager;

	/* ========== Constructor ========== */

	constructor(
		address _governor,
		address _guardian,
		address _manager
	) AccessControl(IAuthority(address(this))) {
		if (_governor == address(0) || _guardian == address(0) || _manager == address(0)) {
			revert CustomErrors.InvalidAddress();
		}
		governor = _governor;
		emit GovernorPushed(address(0), governor);
		emit GovernorPulled(address(0), governor);
		guardian[_guardian] = true;
		emit GuardianPushed(_guardian);
		manager = _manager;
		emit ManagerPushed(address(0), manager);
		emit ManagerPulled(address(0), manager);
	}

	/* ========== GOV ONLY ========== */

	function pushGovernor(address _newGovernor) external {
		_onlyGovernor();
		if (_newGovernor == address(0)) {
			revert CustomErrors.InvalidAddress();
		}
		newGovernor = _newGovernor;
		emit GovernorPushed(governor, newGovernor);
	}

	function pushGuardian(address _newGuardian) external {
		_onlyGovernor();
		if (_newGuardian == address(0)) {
			revert CustomErrors.InvalidAddress();
		}
		guardian[_newGuardian] = true;
		emit GuardianPushed(_newGuardian);
	}

	function pushManager(address _newManager) external {
		_onlyGovernor();
		if (_newManager == address(0)) {
			revert CustomErrors.InvalidAddress();
		}
		newManager = _newManager;
		emit ManagerPushed(manager, newManager);
	}

	function pullGovernor() external {
		require(msg.sender == newGovernor, "!newGovernor");
		emit GovernorPulled(governor, newGovernor);
		governor = newGovernor;
		newGovernor = address(0);
	}

	function revokeGuardian(address _guardian) external {
		_onlyGovernor();
		emit GuardianRevoked(_guardian);
		guardian[_guardian] = false;
	}

	function pullManager() external {
		require(msg.sender == newManager, "!newManager");
		emit ManagerPulled(manager, newManager);
		manager = newManager;
		newManager = address(0);
	}
}
