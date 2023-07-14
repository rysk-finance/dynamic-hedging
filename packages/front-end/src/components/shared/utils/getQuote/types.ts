import type { BigNumber } from "ethers";

export interface QuoteProps {
  expiry: number;
  strike: BigNumber;
  isPut: boolean;
  orderSize: number;
  isSell: boolean;
  collateral?: "USDC" | "WETH";
}

export interface QuoteData {
  acceptablePremium: BigNumber;
  breakEven: number;
  fee: number;
  premium: number;
  quote: number;
  slippage: number;
}
