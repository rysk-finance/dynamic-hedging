// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

/**
 *  @title Modular contract used by the liquidity pool to calculate the value of its ERC20 ault token
 *  @dev Has a main external function, calculateTokenPrice() which will be called by the liquidity pool
 *  each time the token value is needed.
 */
contract DhvTokenCalculations {
	/*
	 * @notice calculates the USDC value of the Liquidity pool's ERC20 vault share token denominated in e6

	 */
	function calculateTokenPrice() external returns (uint256 tokenPrice) {}
}
