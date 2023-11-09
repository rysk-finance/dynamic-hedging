import type { Dispatch, SetStateAction } from "react";

import type { CallOrPut, CollateralType } from "src/state/types";

export interface CollateralDataState {
  amount: string;
  asset: CollateralType;
  callOrPut?: CallOrPut;
  collateral: number;
  disabled: boolean;
  expiry: string;
  hasRequiredCapital: boolean;
  liquidationPrice: number;
  now: string;
  remainingBalanceUSDC: number;
  remainingBalanceWETH: number;
  requiredApproval: string;
  strike?: number;
}

export interface PricingProps {
  collateralData: CollateralDataState;
}

export interface ToggleProps {
  depositToggleState: {
    isDepositing: boolean;
    setIsDepositing: Dispatch<SetStateAction<boolean>>;
  };
}
