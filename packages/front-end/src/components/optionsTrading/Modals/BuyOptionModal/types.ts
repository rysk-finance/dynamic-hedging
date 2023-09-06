import type { BigNumber } from "ethers";

import type { CallOrPut } from "src/state/types";

export interface PositionDataState {
  acceptablePremium: BigNumber;
  breakEven: number;
  callOrPut?: CallOrPut;
  expiry: string;
  exposure: number;
  fee: number;
  now: string;
  premium: number;
  quote: number;
  remainingBalance: number;
  requiredApproval: string;
  slippage: number;
  strike?: number;
}

export interface PricingProps {
  positionData: PositionDataState;
  size: string;
}
