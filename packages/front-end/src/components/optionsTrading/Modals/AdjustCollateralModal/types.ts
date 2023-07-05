import type { Dispatch, SetStateAction } from "react";

import type { CollateralType } from "src/state/types";

export interface CollateralDataState {
  asset: CollateralType;
  collateral: number;
  disabled: boolean;
  hasRequiredCapital: boolean;
  liquidationPrice: number;
  now: string;
  remainingBalanceUSDC: number;
  remainingBalanceWETH: number;
  requiredApproval: string;
  series?: string;
}

export interface PricingProps {
  collateralData: CollateralDataState;
}

export interface SymbolProps {
  series?: string;
}

export interface ToggleProps {
  depositToggleState: {
    isDepositing: boolean;
    setIsDepositing: Dispatch<SetStateAction<boolean>>;
  };
}
