export const RYSK_ERRORS = {
  // OptionExchange.sol
  InvalidInput: "Invalid input.",
  UnapprovedSeries: "Series not approved.",
  SeriesNotBuyable: "Series not buyable.",
  CollateralAssetInvalid: "Invalid collateral asset.",
  MaxLiquidityBufferReached: "Max liquidity buffer reached.",
  NonExistentOToken: "Non-existent oToken.",
  NonWhitelistedOToken: "Non-whitelisted oToken.",
  SeriesNotSellable: "Series not sellable.",
  StrikeAssetInvalid: "Invalid strike asset.",
  UnderlyingAssetInvalid: "Invalid underlying asset.",
  OptionExpiryInvalid: "Invalid option expiry.",
  OptionStrikeInvalid: "Invalid option strike.",
  IssuanceFailed: "Issuance failed.",
  InvalidExpiry: "Invalid expiry.",
  InvalidAmount: "Invalid amount.",
  InvalidShareAmount: "Invalid share amount.",
  WithdrawExceedsLiquidity: "Required premium greater than balance.",
  TradingPaused: "Trading paused.",

  // Accounting.sol
  TotalSupplyReached: "Amount too large.",
  InsufficientShareBalance: "Insufficient share balance.",
  NoExistingWithdrawal: "No pending withdrawal.",
  EpochNotClosed: "Epoch not closed.",

  // VolatilityFeed.sol
  IVNotFound: "IV not found.",

  // PriceFeed.sol
  SequencerDown: "The sequencer is down.",
  GracePeriodNotOver: "Grace period not over.",
} as const;
