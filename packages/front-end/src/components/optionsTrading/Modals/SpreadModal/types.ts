import type { BigNumber } from "ethers";
import type { Dispatch, SetStateAction } from "react";

import { OptionChainModalActions } from "src/state/types";
import type { Addresses } from "../Shared/types";

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
  isPut: boolean;
  now: string;
  premium: number;
  quotes: [number, number];
  remainingBalance: number;
  requiredApproval: string;
  slippage: number;
  strikes: [number, number];
}

export interface SpreadAddresses extends Omit<Addresses, "token"> {
  marginPool: HexString;
  token: [HexString | undefined, HexString | undefined];
}

export interface ModalProps {
  strategy:
    | OptionChainModalActions.CALL_CREDIT_SPREAD
    | OptionChainModalActions.PUT_CREDIT_SPREAD;
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
