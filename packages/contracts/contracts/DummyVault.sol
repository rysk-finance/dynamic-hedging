// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

contract DummyVault {
	mapping(address => uint256) addressToBalance;

	function deposit(uint256 _amount) public {
		addressToBalance[msg.sender] += _amount;
	}

	function withdraw(uint256 amount) public {
		require(amount <= addressToBalance[msg.sender]);
		addressToBalance[msg.sender] -= amount;
	}

	function getBalance() public view returns (uint256) {
		return addressToBalance[msg.sender];
	}
}
