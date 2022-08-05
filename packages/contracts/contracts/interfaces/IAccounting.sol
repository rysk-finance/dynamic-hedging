// SPDX-License-Identifier: UNLICENSED

pragma solidity >=0.8.9;

/// @title Accounting contract to calculate the dhv token value and handle deposit/withdraw mechanics

interface IAccounting {
	struct DepositReceipt {
		uint128 epoch;
		uint128 amount; // collateral decimals
		uint256 unredeemedShares; // e18
	}

	struct WithdrawalReceipt {
		uint128 epoch;
		uint128 shares; // e18
	}

	/**
	 * @notice logic for adding liquidity to the options liquidity pool
	 * @param  depositor the address making the deposit
	 * @param  _amount amount of the collateral asset to deposit
	 * @return depositAmount the amount to deposit from the round
	 * @return unredeemedShares number of shares held in the deposit receipt that havent been redeemed
	 */
	function deposit(address depositor, uint256 _amount)
		external
		returns (uint256 depositAmount, uint256 unredeemedShares);

	/**
	 * @notice logic for allowing a user to redeem their shares from a previous epoch
	 * @param  redeemer the address making the deposit
	 * @param  shares amount of the collateral asset to deposit
	 * @return toRedeem the amount to actually redeem
	 * @return depositReceipt the updated deposit receipt after the redeem has completed
	 */
	function redeem(address redeemer, uint256 shares)
		external
		returns (uint256 toRedeem, DepositReceipt memory depositReceipt);

	/**
	 * @notice logic for accounting a user to initiate a withdraw request from the pool
	 * @param  withdrawer the address carrying out the withdrawal
	 * @param  shares the amount of shares to withdraw for
	 * @return withdrawalReceipt the new withdrawal receipt to pass to the liquidityPool
	 */
	function initiateWithdraw(address withdrawer, uint256 shares)
		external
		returns (WithdrawalReceipt memory withdrawalReceipt);

	/**
	 * @notice logic for accounting a user to complete a withdrawal
	 * @param  withdrawer the address carrying out the withdrawal
	 * @param  shares the amount of shares to withdraw for
	 * @return amountNeeded      the amount of funds needed to withdraw completely
	 * @return withdrawalAmount  the amount of collateral to withdraw
	 * @return withdrawalShares  the number of shares to withdraw
	 * @return withdrawalReceipt the new withdrawal receipt to pass to the liquidityPool
	 */
	function completeWithdraw(address withdrawer, uint256 shares)
		external
		returns (
			int256 amountNeeded,
			uint256 withdrawalAmount,
			uint256 withdrawalShares,
			WithdrawalReceipt memory withdrawalReceipt
		);

	function executeEpochCalculation(
		uint256 totalSupply,
		uint256 assets,
		int256 liabilities
	) external view returns (uint256 newPricePerShare, uint256 sharesToMint);

	// /**
	//  * @notice calculates the USDC value of the Liquidity pool's ERC20 vault share token denominated in e6
	//  * @param  totalSupply the total supply of the liquidity pool's erc20
	//  * @param  assets      the value of assets held by the pool
	//  * @param  liabilities the value of liabilities held by the pool
	//  * @return tokenPrice  the value of the token in e6 terms
	//  */
	// function calculateTokenPrice(
	// 	uint256 totalSupply,
	// 	uint256 assets,
	// 	int256 liabilities
	// ) internal returns (uint256 tokenPrice);

	/**
	 * @notice get the number of shares for a given amount
	 * @param _amount  the amount to convert to shares - assumed in collateral decimals
	 * @param assetPerShare the amount of assets received per share
	 * @return shares the number of shares based on the amount - assumed in e18
	 */
	function sharesForAmount(uint256 _amount, uint256 assetPerShare)
		external
		view
		returns (uint256 shares);
}
