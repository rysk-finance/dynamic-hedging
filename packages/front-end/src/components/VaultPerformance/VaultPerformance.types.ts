interface PricePerShareEpoch {
  epoch: string;
  ethPrice: string;
  growthSinceFirstEpoch: string;
  predictedGrowthSinceFirstEpoch?: string;
  timestamp: string;
  value: string;
  __typename: string;
}

export interface QueryData {
  pricePerShares: PricePerShareEpoch[];
}

export interface ChartData
  extends Omit<
    PricePerShareEpoch,
    | "growthSinceFirstEpoch"
    | "predictedGrowthSinceFirstEpoch"
    | "value"
    | "ethPrice"
  > {
  ethPrice: number;
  predictedEthPrice: number | null;
  ethWeeklyChange: number;
  growthSinceFirstEpoch: number;
  predictedGrowthSinceFirstEpoch: number | null;
  epochWeeklyChange: number;
  isPrediction: boolean;
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: {
    payload: {
      epoch: string;
      epochWeeklyChange: number;
      ethWeeklyChange: number;
      isPrediction: boolean;
    };
    value: number;
  }[];
  label?: string;
}

export interface CustomLegendProps {
  payload?: { color: string; value: string }[];
}

export interface ChartProps {
  chartData: ChartData[];
}

export interface CustomDotProps {
  cx?: number;
  cy?: number;
  fill?: string;
  rx?: number;
  size?: number;
  value?: number;
}