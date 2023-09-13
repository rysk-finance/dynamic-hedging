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

export const RYSK_SIGHASH_ERRORS = {
  "0xb4fa3fb3": "Invalid input.",
  "0x6c845440": "Max liquidity buffer reached.",
  "0x9e2708f2": "Non-existent oToken.",
  "0xe85ee803": "Non-whitelisted oToken.",
  "0x66bfac3d": "Invalid option expiry.",
  "0x52a27806": "Token imbalance.",
  "0x075fd2b1": "Unauthorised.",
  "0xf1ece51c": "Series not approved.",
  "0xec93f020": "UnauthorisedSender",
  "0xbff9e445": "Invalid underlying asset.",
  "0xe6c4247b": "Invalid address.",
  "0x2c5211c6": "Invalid amount.",
  "0x8c88122d": "Invalid share amount.",
  "0xecdc6615": "Issuance failed.",
  "0xe04ba975": "Invalid option strike.",
  "0x02b874a6": "Trading paused.",
  "0xb84beb5d": "Required premium greater than balance.",
  "0xd15f73b5": "Grace period not over.",
  "0x032b3d00": "The sequencer is down.",
  "0xbb9f1668": "Exchange not paused",
  "0x4485c2d0": "IV not found.",
  "0x39c15699": "Epoch not closed.",
  "0x0a73ab6c": "Existing withdrawal.",
  "0xaf4e51c7": "Insufficient share balance.",
  "0xe3c0287b": "No existing withdrawal.",
  "0x7be9badb": "Total supply reached.",
  "0x9d3b9e01": "Collateral asset invalid.",
  "0xe9a56c20": "Premium too small.",
} as { [key: HexString]: string };

export const RYSK_SIGHASH_NO_SUPPORT_ERRORS = {
  "0x43a1bda9": "This series is not currently buyable. Please try again later.",
  "0x4698cf4f":
    "This series is not currently sellable. Please try again later.",
  "0xfa6ad355": "Slippage is too high. Please try a smaller position size.",
  "0x04213078": "This trade is too large. Please try a smaller position size.",
  "0xeddee5b2": "This trade is too small. Please try a larger position size.",
} as { [key: HexString]: string };
