import type { CallOrPut } from "src/state/types";

export interface LiquidationProps {
  amount: number;
  callOrPut: CallOrPut;
  collateral: number;
  collateralAddress: HexString;
  expiry: number;
  strikePrice: number;
}
