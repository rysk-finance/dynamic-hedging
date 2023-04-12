import type { PropsWithChildren } from "react";

export interface CellProps extends PropsWithChildren {
  cellClasses?: string;
}

interface BaseProps {
  value: number;
}

export interface IVProps extends BaseProps {}

export interface QuoteProps extends BaseProps {
  clickFn: VoidFunction;
  disabled: boolean;
}

export interface DeltaProps extends BaseProps {}

export interface PositionProps extends BaseProps {
  clickFn: VoidFunction;
  disabled: boolean;
}

export interface ExposureProps extends BaseProps {}

export interface StrikeProps extends BaseProps {
  callAtTheMoney: boolean;
  putAtTheMoney: boolean;
}
