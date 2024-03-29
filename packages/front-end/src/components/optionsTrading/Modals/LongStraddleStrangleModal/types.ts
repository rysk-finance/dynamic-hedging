import type { BigNumber } from "ethers";
import type { Dispatch, SetStateAction } from "react";

import { OptionChainModalActions } from "src/state/types";

// [PUT, CALL]
export type StrategyStrikesTuple = [string, string];

export interface PositionDataState {
  acceptablePremium: BigNumber;
  breakEven: [number, number];
  expiry: string;
  exposure: [number, number];
  fee: number;
  now: string;
  premium: number;
  quote: number;
  remainingBalance: number;
  requiredApproval: string;
  slippage: number;
  strikes?: [number, number];
}

export interface ModalProps {
  strategy:
    | OptionChainModalActions.LONG_STRADDLE
    | OptionChainModalActions.LONG_STRANGLE;
}

export interface InfoProps extends ModalProps {
  positionData: PositionDataState;
}

export interface PricingProps extends ModalProps {
  positionData: PositionDataState;
  size: string;
  strikeState: {
    selectedStrike: StrategyStrikesTuple;
    setSelectedStrike: Dispatch<SetStateAction<StrategyStrikesTuple>>;
  };
}
