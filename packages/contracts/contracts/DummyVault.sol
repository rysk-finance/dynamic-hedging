// SPDX-License-Identifier: GPL-3.0

pragma solidity >=0.7.0 <0.9.0;

contract DummyVault {
	mapping(address => uint256) addressToBalance;

	function deposit() public payable {
		addressToBalance[msg.sender] += msg.value;
	}

	function withdraw(uint256 amount) public {
		require(amount <= addressToBalance[msg.sender]);
		addressToBalance[msg.sender] -= amount;
		payable(msg.sender).transfer(amount);
	}

	function getBalance() public view returns (uint256) {
		return addressToBalance[msg.sender];
	}
}
