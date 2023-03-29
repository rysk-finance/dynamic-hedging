export interface PositionDataState {
  created: string | null;
  now: string | null;
  totalSize: number;
  totalValue: number;
  totalPaid: number;
  inProfit: boolean;
  title: string | null;
}

export interface PricingProps {
  positionData: PositionDataState;
}
