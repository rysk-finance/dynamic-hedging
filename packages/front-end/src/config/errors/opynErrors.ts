export const OPYN_ERRORS = {
  // NewController.sol
  C4: "System is paused", // partially
  C5: "System is paused", // fully
  C6: "You are not authorized to run this action",
  C9: "DHV is already set as operator", // this should never really happen but doesn't hurt to have it
  C12: "Can not run actions for different owners", // ❌ shouldn't happen in our app
  C13: "Can not run actions on different vaults",
  C14: "Invalid final vault state.",
  C15: "Vault does not exist", // ❌ shouldn't happen in our app
  C16: "Cannot deposit long otoken from this address", // ❌ shouldn't happen in our app
  C17: "Otoken is not whitelisted to be used as collateral", // ❌ shouldn't happen in our app
  C18: "Otoken used as collateral is already expired", // ❌ shouldn't happen in our app
  C19: "Cannot withdraw an expired otoken", // ❌
  C20: "Cannot deposit collateral from this address", // ❌
  C21: "Asset cannot be used as collateral", // ❌
  C22: "Cannot withdraw collateral from a vault with an expired short otoken", // check
  C23: "Otoken is not whitelisted to be minted", // ❌ shouldn't happen in our app
  C24: "Cannot mint an expired otoken", // ❌ shouldn't happen in our app
  C25: "Cannot burn from this address", // ❌ shouldn't happen in our app
  C26: "Cannot burn an expired otoken", // ❌ shouldn't happen in our app
  C27: "Otoken is not whitelisted to be redeemed", // ❌ shouldn't happen in our app
  C28: "Cannot redeem an un-expired otoken", // ❌ shouldn't happen in our app
  C29: "Asset prices not finalized yet", // ❌ shouldn't happen in our app
  C30: "Cannot settle vault with no otoken", // ❌ shouldn't happen in our app
  C31: "Cannot settle vault with un-expired otoken", // ❌ shouldn't happen in our app
  C32: "Cannot settle undercollateralized vault", // ❌ shouldn't happen in our app
  C35: "Invalid vault id", // ❌ shouldn't happen in our app
  C37: "Collateral exceed naked margin cap", // ❌ shouldn't happen in our app

  // MarginVault
  V1: "Invalid short otoken amount",
  V2: "Invalid short otoken index",
  V3: "Short otoken address mismatch",
  V4: "Invalid long otoken amount",
  V5: "Invalid long otoken index",
  V6: "Long otoken address mismatch",
  V7: "Invalid collateral amount",
  V8: "Invalid collateral token index",
  V9: "Collateral token address mismatch",

  // NewCalculator.sol
  "MarginCalculator: Invalid token address": "Invalid series",
  "MarginCalculator: Otoken not expired yet": "Series not expired",
  "MarginCalculator: Too many short otokens in the vault":
    "Only one short otoken allowed per vault",
  "MarginCalculator: Too many long otokens in the vault":
    "Only one long otoken allowed per vault",
  "MarginCalculator: Too many collateral assets in the vault":
    "Only one collateral asset allowed per vault",
  "MarginCalculator: naked margin vault cannot have long otoken":
    "Naked margin vault cannot have long otoken",
  "MarginCalculator: long asset not marginable for short asset":
    "Long asset not marginable for short asset",
  "MarginCalculator: collateral asset not marginable for short asset":
    "Collateral asset not marginable for short asset",
} as const;
