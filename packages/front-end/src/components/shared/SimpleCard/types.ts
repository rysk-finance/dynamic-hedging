import type { PropsWithChildren } from "react";

export interface CardProps extends PropsWithChildren {
  disabled?: boolean;
  explainer: string;
  hasData: boolean;
  loading: boolean;
  span?: (`${string}:col-span-${number}` | `col-span-${number}`)[];
  title: string;
}
