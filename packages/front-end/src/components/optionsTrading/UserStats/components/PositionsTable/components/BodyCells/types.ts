import type { ActivePositions } from "src/state/types";

export interface SeriesProps {
  isShort: boolean;
  series: string;
  strategyTimestampIndex: number;
}

export interface SizeProps {
  amount: number;
}

export interface DeltaProps {
  delta: number;
}

export interface ProfitLossProps {
  profitLoss: number;
  suffix?: string;
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
