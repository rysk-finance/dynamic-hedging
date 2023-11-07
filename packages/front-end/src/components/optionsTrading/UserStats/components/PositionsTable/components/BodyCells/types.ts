import type { ActivePositions } from "src/state/types";

export interface SeriesProps
  extends Pick<
    ActivePositions,
    "isCreditSpread" | "isPut" | "isShort" | "series"
  > {
  strategyTimestampIndex: number;
}

export interface SizeProps {
  amount: number;
}

export interface DeltaProps {
  delta: number;
}

export interface ProfitLossProps {
  profitLoss: [number, number];
  suffix?: string;
  withFees: boolean;
}

export interface EntryProps {
  entry: number;
}

export interface MarkProps {
  mark: number;
}

export interface LiquidationProps
  extends Pick<
    ActivePositions,
    | "amount"
    | "collateral"
    | "expiryTimestamp"
    | "id"
    | "isPut"
    | "isSpread"
    | "series"
    | "strikes"
  > {}

export interface BreakEvenProps {
  breakEven: number;
}

export interface ActionProps
  extends Pick<
    ActivePositions,
    | "action"
    | "amount"
    | "disabled"
    | "collateral"
    | "expiryTimestamp"
    | "id"
    | "isPut"
    | "isShort"
    | "isSpread"
    | "longCollateralAddress"
    | "series"
    | "shortUSDCExposure"
    | "strikes"
  > {}
