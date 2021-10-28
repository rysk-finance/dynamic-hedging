// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;

/**
 * @dev Interface of OPYN Options Exchange Contract
 */

interface IOptionsExchange {
   /**
     * @notice This function sells oTokens on Uniswap and sends back payoutTokens to the receiver
     * @param receiver The address to send the payout tokens back to
     * @param oTokenAddress The address of the oToken to sell
     * @param payoutTokenAddress The address of the token to receive the premiums in
     * @param oTokensToSell The number of oTokens to sell
     */
    function sellOTokens(address payable receiver, address oTokenAddress, address payoutTokenAddress, uint256 oTokensToSell) external;

}
