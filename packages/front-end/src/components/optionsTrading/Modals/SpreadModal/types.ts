import type { BigNumber } from "ethers";
import type { Dispatch, SetStateAction } from "react";

import { CallOrPut, OptionChainModalActions } from "src/state/types";

// [SHORT, LONG]
export type StrategyStrikesTuple = [string, string];

export interface PositionDataState {
  acceptablePremium: [BigNumber, BigNumber];
  breakEven: number;
  collateral: number;
  expiry: string;
  exposure: number;
  fee: number;
  hasRequiredCapital: boolean;
  isCredit: boolean;
  isPut: boolean;
  netPremium: number;
  now: string;
  premium: number;
  quotes: [number, number];
  remainingBalance: number;
  requiredApproval: string;
  side: CallOrPut;
  slippage: number;
  strikes: [number, number];
}

export interface ModalProps {
  strategy:
    | OptionChainModalActions.CALL_CREDIT_SPREAD
    | OptionChainModalActions.CALL_DEBIT_SPREAD
    | OptionChainModalActions.PUT_CREDIT_SPREAD
    | OptionChainModalActions.PUT_DEBIT_SPREAD;
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
