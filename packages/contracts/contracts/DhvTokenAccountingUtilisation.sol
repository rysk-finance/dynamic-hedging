// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "prb-math/contracts/PRBMathUD60x18.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";

import "./libraries/OptionsCompute.sol";
import "./libraries/Types.sol";
import "./tokens/ERC20.sol";
import "./interfaces/ILiquidityPool.sol";
import "hardhat/console.sol";

/**
 *  @title Modular contract used by the liquidity pool to calculate the value of its ERC20 ault token
 *  @dev Has a main external function, calculateTokenPrice() which will be called by the liquidity pool
 *  each time the token value is needed.
 */
contract DhvTokenAccountingUtilisation {
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

	/*
	 * @notice calculates the USDC value of the Liquidity pool's ERC20 vault share token denominated in e6
	 */
	function calculateTokenPrice(
		uint256 totalSupply,
		uint256 assets,
		uint256 liabilities,
		uint256 collateralAllocated,
		uint256 pendingDeposits,
		uint256 pendingWithdrawals
	) external returns (uint256 tokenPrice) {
		uint256 tokenPriceInitial = totalSupply > 0
			? (1e18 *
				((assets - liabilities) -
					OptionsCompute.convertFromDecimals(pendingDeposits, ERC20(collateralAsset).decimals()))) /
				totalSupply
			: 1e18;
		// collateralAllocated needs to be converted to e18
		tokenPrice = _utilizationPremium(tokenPriceInitial, (10**12 * collateralAllocated).div(assets));
		console.log(tokenPriceInitial, tokenPrice, (10**12 * collateralAllocated).div(assets));
	}

	function _utilizationPremium(uint256 tokenPrice, uint256 utilization)
		internal
		returns (
			// pure
			uint256 utilizationTokenPrice
		)
	{
		console.log("tokenPrice:", tokenPrice, "utilization:", utilization);
		return tokenPrice.mul(1e18 - (utilization.powu(8)).mul(1e18 / 8));
	}

	// ------------------ Called functions from LP ----------------

	function deposit(address depositor, uint256 _amount)
		external
		view
		returns (uint256 depositAmount, uint256 unredeemedShares)
	{
		_isLiquidityPool();
		uint256 collateralCap = liquidityPool.collateralCap();
		uint256 currentEpoch = liquidityPool.epoch();
		// check the total allowed collateral amount isnt surpassed by incrementing the total assets with the amount denominated in e18
		uint256 totalAmountWithDeposit = liquidityPool.getAssets() +
			OptionsCompute.convertFromDecimals(_amount, ERC20(collateralAsset).decimals());
		if (totalAmountWithDeposit > collateralCap) {
			revert CustomErrors.TotalSupplyReached();
		}
		Types.DepositReceipt memory depositReceipt = liquidityPool.depositReceipts(depositor);
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

	function redeem(
		address redeemer,
		uint256 shares,
		Types.DepositReceipt memory depositReceipt
	) external view returns (uint256 toRedeem, Types.DepositReceipt memory) {
		_isLiquidityPool();
		uint256 currentEpoch = liquidityPool.epoch();
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
		console.log(depositReceipt.unredeemedShares);
		return (toRedeem, depositReceipt);
	}

	/**
	 * @notice get the number of shares for a given amount
	 * @param _amount  the amount to convert to shares - assumed in collateral decimals
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
	 * @return amount the number of amount based on shares in collateral decimals
	 */
	function amountForShares(uint256 _shares, uint256 _assetPerShare)
		external
		view
		returns (uint256 amount)
	{
		amount = OptionsCompute.convertToDecimals(
			(_shares * _assetPerShare) / PRBMath.SCALE,
			ERC20(collateralAsset).decimals()
		);
	}

	function _isLiquidityPool() internal view {
		if (msg.sender != address(liquidityPool)) {
			revert CustomErrors.NotLiquidityPool();
		}
	}
}
