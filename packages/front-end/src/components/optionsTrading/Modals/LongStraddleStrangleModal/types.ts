import type { BigNumber } from "ethers";
import type { Dispatch, SetStateAction } from "react";

import { OptionChainModalActions } from "src/state/types";

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

export interface InfoProps {
  positionData: PositionDataState;
}

export interface ModalProps {
  strategy:
    | OptionChainModalActions.LONG_STRADDLE
    | OptionChainModalActions.LONG_STRANGLE;
}

export interface PricingProps {
  amount: string;
  positionData: PositionDataState;
  strikeState: {
    selectedStrike: string;
    setSelectedStrike: Dispatch<SetStateAction<string>>;
  };
}
