// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

interface CustomErrors {
    error IVNotFound();
    error InvalidPrice();
    error InvalidBuyer();
    error OrderExpired();
    error InvalidAmount();
    error IssuanceFailed();
    error DeltaNotDecreased();
    error NonExistentOtoken();
    error OrderExpiryTooLong();
    error InvalidShareAmount();
    error TotalSupplyReached();
    error StrikeAssetInvalid();
    error OptionStrikeInvalid();
    error OptionExpiryInvalid();
    error CollateralAssetInvalid();
    error UnderlyingAssetInvalid();
    error CollateralAmountInvalid();
    error WithdrawExceedsLiquidity();
    error MaxLiquidityBufferReached();
    error CustomOrderInsufficientPrice();
    error CustomOrderInvalidDeltaValue();
    error DeltaQuoteError(uint256 quote, int256 delta);
    error StrikeAmountExceedsLiquidity(uint256 strikeAmount, uint256 strikeLiquidity);
    error MinStrikeAmountExceedsLiquidity(uint256 strikeAmount, uint256 strikeAmountMin);
    error UnderlyingAmountExceedsLiquidity(uint256 underlyingAmount, uint256 underlyingLiquidity);
    error MinUnderlyingAmountExceedsLiquidity(uint256 underlyingAmount, uint256 underlyingAmountMin);
}