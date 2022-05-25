import { BigNumber } from "ethers";

export const MAX_UINT_256 =
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

// Using strings in constructor to avoid JS max int issues.
export const BIG_NUMBER_DECIMALS = {
  USDC: BigNumber.from("1000000"),
  RYSK: BigNumber.from("1000000000000000000"),
};
