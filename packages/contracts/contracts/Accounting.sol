// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "prb-math/contracts/PRBMathUD60x18.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";

import "./tokens/ERC20.sol";
import "./libraries/OptionsCompute.sol";

import "./interfaces/IAccounting.sol";
import "./interfaces/ILiquidityPool.sol";

import "hardhat/console.sol";

/**
 *  @title Modular contract used by the liquidity pool to conducting accounting logic
 */
contract Accounting is IAccounting {
	using PRBMathSD59x18 for int256;
	using PRBMathUD60x18 for uint256;

	///////////////////////////
	/// immutable variables ///
	///////////////////////////

	// the liquidity pool address
	ILiquidityPool public immutable liquidityPool;
	// asset that denominates the strike price
	address public immutable strikeAsset;
	// asset that is used as the reference asset
	address public immutable underlyingAsset;
	// asset that is used for collateral asset
	address public immutable collateralAsset;
	// MAX_BPS
	uint256 private constant MAX_BPS = 10000;

	constructor(
		address _liquidityPool,
		address _strikeAsset,
		address _underlyingAsset,
		address _collateralAsset
	) {
		liquidityPool = ILiquidityPool(_liquidityPool);
		strikeAsset = _strikeAsset;
		underlyingAsset = _underlyingAsset;
		collateralAsset = _collateralAsset;
	}

	///////////////////////
	/// complex getters ///
	///////////////////////

	/**
	 * @notice calculates the USDC value of the Liquidity pool's ERC20 vault share token denominated in e6
	 * @param  totalSupply the total supply of the liquidity pool's erc20
	 * @param  assets      the value of assets held by the pool
	 * @param  liabilities the value of liabilities held by the pool
	 * @return tokenPrice  the value of the token in e6 terms
	 */
	function calculateTokenPrice(
		uint256 totalSupply,
		uint256 assets,
		int256 liabilities
	) internal view returns (uint256 tokenPrice) {
		if (int256(assets) < liabilities) {
			revert CustomErrors.LiabilitiesGreaterThanAssets();
		}
		uint256 NAV = uint256((int256(assets) - liabilities));
		tokenPrice = totalSupply > 0
			? (1e18 *
				(NAV -
					OptionsCompute.convertFromDecimals(
						liquidityPool.pendingDeposits(),
						ERC20(collateralAsset).decimals()
					))) / totalSupply
			: 1e18;
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
		view
		returns (uint256 depositAmount, uint256 unredeemedShares)
	{
		uint256 collateralCap = liquidityPool.collateralCap();
		uint256 currentEpoch = liquidityPool.depositEpoch();
		// check the total allowed collateral amount isnt surpassed by incrementing the total assets with the amount denominated in e18
		uint256 totalAmountWithDeposit = liquidityPool.getAssets() +
			OptionsCompute.convertFromDecimals(_amount, ERC20(collateralAsset).decimals());
		if (totalAmountWithDeposit > collateralCap) {
			revert CustomErrors.TotalSupplyReached();
		}
		IAccounting.DepositReceipt memory depositReceipt = liquidityPool.depositReceipts(depositor);
		// check for any unredeemed shares
		unredeemedShares = uint256(depositReceipt.unredeemedShares);
		// if there is already a receipt from a previous round then acknowledge and record it
		if (depositReceipt.epoch != 0 && depositReceipt.epoch < currentEpoch) {
			unredeemedShares += sharesForAmount(
				depositReceipt.amount,
				liquidityPool.epochPricePerShare(depositReceipt.epoch)
			);
		}
		depositAmount = _amount;
		// if there is a second deposit in the same round then increment this amount
		if (currentEpoch == depositReceipt.epoch) {
			depositAmount += uint256(depositReceipt.amount);
		}
		require(depositAmount <= type(uint128).max, "overflow");
	}

	/**
	 * @notice logic for allowing a user to redeem their shares from a previous epoch
	 * @param  redeemer the address making the deposit
	 * @param  shares amount of the collateral asset to deposit
	 * @return toRedeem the amount to actually redeem
	 * @return depositReceipt the updated deposit receipt after the redeem has completed
	 */
	function redeem(address redeemer, uint256 shares)
		external
		view
		returns (uint256 toRedeem, IAccounting.DepositReceipt memory)
	{
		IAccounting.DepositReceipt memory depositReceipt = liquidityPool.depositReceipts(redeemer);

		uint256 currentEpoch = liquidityPool.depositEpoch();
		// check for any unredeemed shares
		uint256 unredeemedShares = uint256(depositReceipt.unredeemedShares);
		// if there is already a receipt from a previous round then acknowledge and record it
		if (depositReceipt.epoch != 0 && depositReceipt.epoch < currentEpoch) {
			unredeemedShares += sharesForAmount(
				depositReceipt.amount,
				liquidityPool.epochPricePerShare(depositReceipt.epoch)
			);
		}
		// if the shares requested are greater than their unredeemedShares then floor to unredeemedShares, otherwise
		// use their requested share number
		toRedeem = shares > unredeemedShares ? unredeemedShares : shares;
		if (toRedeem == 0) {
			return (0, depositReceipt);
		}
		// if the deposit receipt is on this epoch and there are unredeemed shares then we leave amount as is,
		// if the epoch has past then we set the amount to 0 and take from the unredeemedShares
		if (depositReceipt.epoch < currentEpoch) {
			depositReceipt.amount = 0;
		}
		depositReceipt.unredeemedShares = uint128(unredeemedShares - toRedeem);
		return (toRedeem, depositReceipt);
	}

	/**
	 * @notice logic for accounting a user to initiate a withdraw request from the pool
	 * @param  withdrawer the address carrying out the withdrawal
	 * @param  shares the amount of shares to withdraw for
	 * @return withdrawalReceipt the new withdrawal receipt to pass to the liquidityPool
	 */
	function initiateWithdraw(address withdrawer, uint256 shares)
		external
		view
		returns (IAccounting.WithdrawalReceipt memory withdrawalReceipt)
	{
		if (liquidityPool.balanceOf(withdrawer) < shares) {
			revert CustomErrors.InsufficientShareBalance();
		}
		uint256 currentEpoch = liquidityPool.withdrawalEpoch();
		withdrawalReceipt = liquidityPool.withdrawalReceipts(withdrawer);

		uint256 existingShares = withdrawalReceipt.shares;
		uint256 withdrawalShares;
		// if they already have an initiated withdrawal from this round just increment
		if (withdrawalReceipt.epoch == currentEpoch) {
			withdrawalShares = existingShares + shares;
		} else {
			// do 100 wei just in case of any rounding issues
			if (existingShares > 100) {
				revert CustomErrors.ExistingWithdrawal();
			}
			withdrawalShares = shares;
			withdrawalReceipt.epoch = uint128(currentEpoch);
		}

		withdrawalReceipt.shares = uint128(withdrawalShares);
	}

	/**
	 * @notice logic for accounting a user to complete a withdrawal
	 * @param  withdrawer the address carrying out the withdrawal
	 * @param  shares the amount of shares to withdraw for
	 * @return withdrawalAmount  the amount of collateral to withdraw
	 * @return withdrawalShares  the number of shares to withdraw
	 * @return withdrawalReceipt the new withdrawal receipt to pass to the liquidityPool
	 */
	function completeWithdraw(address withdrawer, uint256 shares)
		external
		view
		returns (
			uint256 withdrawalAmount,
			uint256 withdrawalShares,
			IAccounting.WithdrawalReceipt memory withdrawalReceipt
		)
	{
		withdrawalReceipt = liquidityPool.withdrawalReceipts(withdrawer);
		// cache the storage variables
		withdrawalShares = shares > withdrawalReceipt.shares ? withdrawalReceipt.shares : shares;
		uint256 withdrawalEpoch = withdrawalReceipt.epoch;
		// make sure there is something to withdraw and make sure the round isnt the current one
		if (withdrawalShares == 0) {
			revert CustomErrors.NoExistingWithdrawal();
		}
		if (withdrawalEpoch == liquidityPool.withdrawalEpoch()) {
			revert CustomErrors.EpochNotClosed();
		}
		// reduced the stored share receipt by the shares requested
		withdrawalReceipt.shares -= uint128(withdrawalShares);
		// get the withdrawal amount based on the shares and pps at the epoch
		withdrawalAmount = amountForShares(
			withdrawalShares,
			liquidityPool.epochPricePerShare(withdrawalEpoch)
		);
		if (withdrawalAmount == 0) {
			revert CustomErrors.InvalidAmount();
		}
	}

	function executeEpochCalculation(
		uint256 totalSupply,
		uint256 assets,
		int256 liabilities
	)
		external
		view
		returns (
			uint256 newPricePerShareDeposit,
			uint256 newPricePerShareWithdrawal,
			uint256 sharesToMint,
			uint256 totalWithdrawAmount,
			int256 amountNeeded
		)
	{
		// get the liquidity that can be withdrawn from the pool without hitting the collateral requirement buffer
		int256 buffer = int256(
			(liquidityPool.collateralAllocated() * liquidityPool.bufferPercentage()) / MAX_BPS
		);
		int256 collatBalance = int256(
			ERC20(collateralAsset).balanceOf(address(liquidityPool)) - liquidityPool.partitionedFunds()
		);
		int256 bufferRemaining = collatBalance + int256(liquidityPool.pendingDeposits()) - buffer;

		newPricePerShareDeposit = newPricePerShareWithdrawal = calculateTokenPrice(
			totalSupply,
			assets,
			liabilities
		);
		console.log("pps deposit:", newPricePerShareDeposit, "pps withdraw:", newPricePerShareDeposit);
		sharesToMint = sharesForAmount(liquidityPool.pendingDeposits(), newPricePerShareDeposit);
		totalWithdrawAmount = amountForShares(
			liquidityPool.pendingWithdrawals(),
			newPricePerShareWithdrawal
		);
		// get the extra liquidity that is needed from hedging reactors
		amountNeeded = int256(totalWithdrawAmount) - bufferRemaining;
	}

	/**
	 * @notice get the number of shares for a given amount
	 * @param _amount  the amount to convert to shares - assumed in collateral decimals
	 * @param assetPerShare the amount of assets received per share
	 * @return shares the number of shares based on the amount - assumed in e18
	 */
	function sharesForAmount(uint256 _amount, uint256 assetPerShare)
		public
		view
		returns (uint256 shares)
	{
		uint256 convertedAmount = OptionsCompute.convertFromDecimals(
			_amount,
			ERC20(collateralAsset).decimals()
		);
		shares = (convertedAmount * PRBMath.SCALE) / assetPerShare;
	}

	/**
	 * @notice get the amount for a given number of shares
	 * @param _shares  the shares to convert to amount in e18
	 * @param _assetPerShare the amount of assets received per share
	 * @return amount the number of amount based on shares in collateral decimals
	 */
	function amountForShares(uint256 _shares, uint256 _assetPerShare)
		public
		view
		returns (uint256 amount)
	{
		amount = OptionsCompute.convertToDecimals(
			(_shares * _assetPerShare) / PRBMath.SCALE,
			ERC20(collateralAsset).decimals()
		);
	}
}
