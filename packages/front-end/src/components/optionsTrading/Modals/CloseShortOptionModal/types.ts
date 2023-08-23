import { BigNumber } from "ethers";

import type { CallOrPut } from "src/state/types";
import { CollateralType } from "src/state/types";

export interface PositionDataState {
  acceptablePremium: BigNumber;
  callOrPut?: CallOrPut;
  collateralReleased: number;
  collateralToRemove: BigNumber;
  collateralType?: CollateralType;
  expiry: string;
  fee: number;
  hasRequiredCapital: boolean;
  now: string;
  premium: number;
  quote: number;
  remainingBalanceUSDC: number;
  remainingBalanceWETH: number;
  remainingCollateral: number;
  slippage: number;
  totalSize: number;
  requiredApproval: string;
  strike?: number;
}

export interface PricingProps {
  collateralAddress?: HexString;
  remainingCollateral: number;
  positionData: PositionDataState;
}
