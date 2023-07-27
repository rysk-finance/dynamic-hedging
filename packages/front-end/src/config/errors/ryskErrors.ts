export const RYSK_ERRORS = {
  // OptionExchange.sol
  InvalidInput: "Invalid input",
  UnapprovedSeries: "Series not tradeable",
  SeriesNotBuyable: "Series not buyable",
  CollateralAssetInvalid: "Invalid collateral asset", // issue
  MaxLiquidityBufferReached: "Max liquidity buffer reached", // cannot sell/close
  NonExistentOToken: "Non-existent oToken",
  NonWhitelistedOToken: "Non-whitelisted oToken",
  SeriesNotSellable: "Series not sellable",
  StrikeAssetInvalid: "Invalid strike asset", // issue
  UnderlyingAssetInvalid: "Invalid underlying asset", // issue,
  OptionExpiryInvalid: "Invalid option expiry", // issue
  OptionStrikeInvalid: "Invalid option strike", // issue
  IssuanceFailed: "Issuance failed", // issue
  InvalidExpiry: "Invalid expiry",
  InvalidAmount: "Invalid amount", // deposit 0
  InvalidShareAmount: "Invalid share amount", // redeem/withdraw 0
  WithdrawExceedsLiquidity: "Buyback premium gretaer than balance", // buyback
  TradingPaused: "Trading paused",
  // Accounting.sol
  TotalSupplyReached: "Amount too large", // depositing too much collateral
  InsufficientShareBalance: "You do not have that many shares",
  NoExistingWithdrawal: "No pending withdrawal",
  EpochNotClosed: "Epoch not closed",
} as const;
