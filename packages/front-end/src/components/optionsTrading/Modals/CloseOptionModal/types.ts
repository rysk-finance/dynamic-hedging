import type { BigNumber } from "ethers";

import type { CallOrPut } from "src/state/types";

export type CloseLongOperation = "close" | "sell";

export interface PositionDataState {
  acceptablePremium: BigNumber;
  callOrPut?: CallOrPut;
  expiry: string;
  fee: number;
  maxCloseSize?: number;
  now: string;
  operation: CloseLongOperation;
  orderTooBig: boolean;
  premium: number;
  quote: number;
  remainingBalance: number;
  slippage: number;
  totalSize: number;
  strike?: number;
}

export interface PricingProps {
  positionData: PositionDataState;
  size: string;
}
