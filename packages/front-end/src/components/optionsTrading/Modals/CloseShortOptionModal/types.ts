import { BigNumber } from "ethers";
import { CollateralType } from "src/state/types";

export interface PositionDataState {
  acceptablePremium: BigNumber;
  collateralReleased: number;
  collateralToRemove: BigNumber;
  collateralType?: CollateralType;
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
  title: string | null;
  requiredApproval: string;
}

export interface PricingProps {
  collateralAddress?: HexString;
  remainingCollateral: number;
  positionData: PositionDataState;
}
