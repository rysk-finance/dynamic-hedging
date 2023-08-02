export const ERC20_ERRORS = {
  "execution reverted: ERC20: transfer amount exceeds balance":
    "Transfer amount exceeds balance",
  "execution reverted: ERC20: transfer amount exceeds allowance":
    "Transfer amount exceeds allowance",
} as const;

export const ERC20_KEYS = Object.keys(ERC20_ERRORS) as Array<
  keyof typeof ERC20_ERRORS
>;
