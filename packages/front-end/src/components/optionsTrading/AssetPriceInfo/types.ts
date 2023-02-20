export interface OneDayChangeProps {
  low: number | null;
  change: number;
  high: number | null;
}

export interface CurrentPriceProps {
  price: number | null;
  latestUpdate: Date | null;
}
