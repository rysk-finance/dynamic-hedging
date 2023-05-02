import { BigNumber } from "ethers";

export interface PositionDataState {
  acceptablePremium: BigNumber;
  fee: number;
  now: string;
  premium: number;
  quote: number;
  remainingBalance: number;
  slippage: number;
  totalSize: number;
  title: string | null;
}

export interface PricingProps {
  positionData: PositionDataState;
}
