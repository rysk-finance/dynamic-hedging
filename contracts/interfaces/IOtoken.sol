// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

/**
 * @dev Interface of OPYN Options Token Contract
 */

interface IOtoken {
    /**
     * @notice adds ETH collateral to an existing Vault, and mints new oTokens and sells the oTokens in one step
     * @param amtToCreate number of oTokens to create
     * @param receiver address to send the Options to
     */
    function addAndSellETHCollateralOption(uint256 amtToCreate, address payable receiver) external payable;
}
