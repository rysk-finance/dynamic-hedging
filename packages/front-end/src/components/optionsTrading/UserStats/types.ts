import type { PropsWithChildren } from "react";

export interface CardProps extends PropsWithChildren {
  disabled?: boolean;
  explainer: string;
  hasData: boolean;
  span?: `col-span-${number}`;
  title: string;
}
