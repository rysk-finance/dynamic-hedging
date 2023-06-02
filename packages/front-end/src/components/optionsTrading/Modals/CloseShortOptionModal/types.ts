import { BigNumber } from "ethers";

export interface PositionDataState {
  acceptablePremium: BigNumber;
  collateralToRemove: BigNumber;
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
