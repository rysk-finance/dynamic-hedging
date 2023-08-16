interface PricePerShareEpoch {
  epoch: string;
  growthSinceFirstEpoch: string;
  predictedGrowthSinceFirstEpoch?: string;
  timestamp: string;
  __typename: string;
}

export interface QueryData {
  pricePerShares: PricePerShareEpoch[];
}

export interface ChartData
  extends Omit<
    PricePerShareEpoch,
    "growthSinceFirstEpoch" | "predictedGrowthSinceFirstEpoch"
  > {
  growthSinceFirstEpoch: number;
  predictedGrowthSinceFirstEpoch: number | null;
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: [
    {
      payload: {
        epoch: string;
      };
      value: number;
    },
    {
      value: number;
    },
    {
      payload: {
        epoch: string;
      };
      value: number;
    },
    {
      value: number;
    },
  ];
  label?: string;
}

export interface ChartProps {
  chartData: ChartData[];
}
