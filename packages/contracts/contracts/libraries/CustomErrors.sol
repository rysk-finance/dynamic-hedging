// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

interface CustomErrors {
	error NotKeeper();
	error IVNotFound();
	error NotHandler();
	error InvalidInput();
	error InvalidPrice();
	error InvalidBuyer();
	error InvalidOrder();
	error OrderExpired();
	error InvalidAmount();
	error TradingPaused();
	error InvalidAddress();
	error IssuanceFailed();
	error EpochNotClosed();
	error InvalidDecimals();
	error TradingNotPaused();
	error NotLiquidityPool();
	error DeltaNotDecreased();
	error NonExistentOtoken();
	error OrderExpiryTooLong();
	error InvalidShareAmount();
	error ExistingWithdrawal();
	error TotalSupplyReached();
	error StrikeAssetInvalid();
	error OptionStrikeInvalid();
	error OptionExpiryInvalid();
	error NoExistingWithdrawal();
	error SpotMovedBeyondRange();
	error ReactorAlreadyExists();
	error CollateralAssetInvalid();
	error UnderlyingAssetInvalid();
	error CollateralAmountInvalid();
	error WithdrawExceedsLiquidity();
	error InsufficientShareBalance();
	error MaxLiquidityBufferReached();
	error LiabilitiesGreaterThanAssets();
	error CustomOrderInsufficientPrice();
	error CustomOrderInvalidDeltaValue();
	error DeltaQuoteError(uint256 quote, int256 delta);
	error TimeDeltaExceedsThreshold(uint256 timeDelta);
	error PriceDeltaExceedsThreshold(uint256 priceDelta);
	error StrikeAmountExceedsLiquidity(uint256 strikeAmount, uint256 strikeLiquidity);
	error MinStrikeAmountExceedsLiquidity(uint256 strikeAmount, uint256 strikeAmountMin);
	error UnderlyingAmountExceedsLiquidity(uint256 underlyingAmount, uint256 underlyingLiquidity);
	error MinUnderlyingAmountExceedsLiquidity(uint256 underlyingAmount, uint256 underlyingAmountMin);
}
