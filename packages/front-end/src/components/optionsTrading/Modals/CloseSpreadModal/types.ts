import { BigNumber } from "ethers";

import type { CallOrPut } from "src/state/types";
import type { CloseLongOperation } from "../Shared/types";

export interface PositionDataState {
  acceptablePremium: [BigNumber, BigNumber];
  callOrPut?: CallOrPut;
  collateralReleased: number;
  collateralToRemove: BigNumber;
  collateralType: "USDC";
  expiry: string;
  exposure: number;
  fee: number;
  hasRequiredCapital: boolean;
  isCredit: boolean;
  isPut: boolean;
  now: string;
  operation: CloseLongOperation;
  premium: number;
  quotes: [number, number];
  remainingBalance: number;
  remainingCollateral: number;
  requiredApproval: string;
  slippage: number;
  strikes?: [string, string];
  totalSize: number;
}

export interface PricingProps {
  positionData: PositionDataState;
  size: string;
}
