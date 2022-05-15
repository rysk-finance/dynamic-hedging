// SPDX-License-Identifier: MIT

pragma solidity >=0.8.9;

interface WETH {
	function balanceOf(address ady) external returns (uint256);

	function deposit() external payable;

	function approve(address, uint256) external;

	function withdraw(uint256 wad) external;

	function transfer(address dst, uint256 wad) external returns (bool);

	function transferFrom(
		address src,
		address dst,
		uint256 wad
	) external returns (bool);

	event Deposit(address indexed dst, uint256 wad);
	event Withdrawal(address indexed src, uint256 wad);
}
