import type { ReactElement, ReactNode } from "react";
import type { Placement } from "tippy.js";

export interface RyskToolTipProps {
  children?: ReactElement;
  disabled?: boolean;
  content: ReactNode;
  placement?: Placement;
}
