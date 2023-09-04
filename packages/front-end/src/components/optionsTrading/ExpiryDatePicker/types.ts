export type VisibleRange = [number, number];

export interface DateListProps {
  visibleRange: VisibleRange;
  handleExpirySelection: (date: string) => VoidFunction;
}
