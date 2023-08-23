import type { BigNumber } from "ethers";
import type { Dispatch, SetStateAction } from "react";

export interface PositionDataState {
  acceptablePremium: BigNumber;
  breakEven: [number, number];
  expiry: string;
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
  amount: string;
  positionData: PositionDataState;
  strikeState: {
    selectedStrike: string;
    setSelectedStrike: Dispatch<SetStateAction<string>>;
  };
}
