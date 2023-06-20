import type { BigNumber } from "ethers";

export interface QuoteProps {
  expiry: number;
  strike: BigNumber;
  isPut: boolean;
  orderSize: number;
  isSell: boolean;
  collateral?: "USDC" | "WETH";
}
