import type { CallOrPut, CollateralType } from "src/state/types";

export interface PositionDataState {
  callOrPut?: CallOrPut;
  collateral: number;
  expiry: string;
  fee: number;
  liquidationPrice: number;
  now: string;
  premium: number;
  quote: number;
  remainingBalanceUSDC: number;
  remainingBalanceWETH: number;
  requiredApproval: string;
  slippage: number;
  strike?: number;
}

export interface PricingProps {
  loading: boolean;
  positionData: PositionDataState;
  type: CollateralType;
}

export interface SymbolProps {
  positionData: PositionDataState;
}
