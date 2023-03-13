import type { PropsWithChildren } from "react";

import type { SelectedOption, StrikeOptions } from "src/state/types";

export interface CellProps extends PropsWithChildren {
  ethPrice: number | null;
  option: StrikeOptions;
  side: SelectedOption["callOrPut"];
  selectedOption: SelectedOption | null;

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

export interface PositionProps extends BaseProps {}

export interface ExposureProps extends BaseProps {}

export interface StrikeProps extends BaseProps {}
