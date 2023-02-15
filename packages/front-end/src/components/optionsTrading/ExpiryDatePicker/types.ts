export type ExpiryDateList = number[];
export type VisibleRange = [number, number];

export interface DateListProps {
  expiryDates: ExpiryDateList;
  visibleRange: VisibleRange;
  expiryDate: number | null;
  handleExpirySelection: (date: number) => VoidFunction;
}
