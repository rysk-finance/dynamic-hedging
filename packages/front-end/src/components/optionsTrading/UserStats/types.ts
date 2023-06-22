export interface CardProps {
  explainer: string;
  disabled?: boolean;
  span?: `col-span-${number}`;
  symbol: string;
  title: string;
  value: number;
}
