import type { CallOrPut } from "src/state/types";

export interface PositionDataState {
  callOrPut?: CallOrPut;
  expiry: string;
  fee: number;
  now: string;
  premium: number;
  quote: number;
  remainingBalance: number;
  requiredApproval: string;
  strike?: number;
}

export interface PricingProps {
  positionData: PositionDataState;
}