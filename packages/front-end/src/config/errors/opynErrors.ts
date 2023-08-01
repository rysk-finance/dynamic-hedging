export const OPYN_ERRORS = {
  // NewController.sol
  C4: "System is partially paused.",
  C5: "System is fully paused.",
  C6: "You are not authorized to run this action.",
  C9: "DHV is already set as operator.",
  C13: "Cannot run actions on different vaults.",
  C14: "Invalid final vault state.",
  C15: "Vault does not exist.",
  C35: "Invalid vault id.",

  // NewCalculator.sol
  "MarginCalculator: Invalid token address": "Invalid series.",
  "MarginCalculator: Otoken not expired yet": "Series not expired.",
  "MarginCalculator: Too many short otokens in the vault":
    "Only one short otoken allowed per vault.",
  "MarginCalculator: Too many long otokens in the vault":
    "Only one long oToken allowed per vault.",
  "MarginCalculator: Too many collateral assets in the vault":
    "Only one collateral asset allowed per vault.",
  "MarginCalculator: naked margin vault cannot have long otoken":
    "Naked margin vault cannot have long oToken.",
  "MarginCalculator: long asset not marginable for short asset":
    "Long asset not marginable for short asset.",
  "MarginCalculator: collateral asset not marginable for short asset":
    "Collateral asset not marginable for short asset.",
} as const;

export const OPYN_CODES = Object.keys(OPYN_ERRORS) as Array<
  keyof typeof OPYN_ERRORS
>;
