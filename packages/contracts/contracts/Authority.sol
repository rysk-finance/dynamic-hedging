// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.0;

import "./interfaces/IAuthority.sol";

import "./libraries/AccessControl.sol";

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
		governor = _governor;
		emit GovernorPushed(address(0), governor, true);
		guardian[_guardian] = true;
		emit GuardianPushed(_guardian, true);
		manager = _manager;
		emit ManagerPushed(address(0), manager, true);
	}

	/* ========== GOV ONLY ========== */

	function pushGovernor(address _newGovernor, bool _effectiveImmediately) external {
		_onlyGovernor();
		if (_effectiveImmediately) governor = _newGovernor;
		newGovernor = _newGovernor;
		emit GovernorPushed(governor, newGovernor, _effectiveImmediately);
	}

	function pushGuardian(address _newGuardian) external {
		_onlyGovernor();
		guardian[_newGuardian] = true;
	}

	function pushManager(address _newManager, bool _effectiveImmediately) external {
		_onlyGovernor();
		if (_effectiveImmediately) manager = _newManager;
		newManager = _newManager;
		emit ManagerPushed(manager, newManager, _effectiveImmediately);
	}

	function pullGovernor() external {
		require(msg.sender == newGovernor, "!newGovernor");
		emit GovernorPulled(governor, newGovernor);
		governor = newGovernor;
	}

	function revokeGuardian(address _guardian) external {
		_onlyGovernor();
		emit GuardianPulled(_guardian);
		guardian[_guardian] = false;
	}

	function pullManager() external {
		require(msg.sender == newManager, "!newManager");
		emit ManagerPulled(manager, newManager);
		manager = newManager;
	}
}
