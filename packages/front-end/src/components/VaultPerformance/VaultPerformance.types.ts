interface PricePerShareEpoch {
  epoch: string;
  growthSinceFirstEpoch: string;
  timestamp: string;
  __typename: string;
}

export interface QueryData {
  pricePerShares: PricePerShareEpoch[];
}

export interface ChartData
  extends Omit<PricePerShareEpoch, "growthSinceFirstEpoch"> {
  growthSinceFirstEpoch: number;
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: [
    {
      value: string;
      payload: { epoch: string };
    }
  ];
  label?: string;
}

export interface ChartProps {
  chartData: ChartData[];
}
