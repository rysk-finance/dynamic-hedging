import type { ReactElement, ReactNode } from "react";
import type { Placement } from "tippy.js";

import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";

import { Info } from "src/Icons";

interface Props {
  children?: ReactElement;
  disabled?: boolean;
  content: ReactNode;
  placement?: Placement;
}

export const RyskTooltip = ({
  children,
  disabled = false,
  content,
  placement = "auto",
}: Props) => (
  <Tippy
    content={content}
    disabled={disabled}
    duration={[200, 150]}
    interactive
    placement={placement}
    theme="rysk"
  >
    {children ? (
      children
    ) : (
      <span
        className={`p-3 ${disabled ? "cursor-not-allowed" : "cursor-help"}`}
      >
        <Info className="inline-flex w-6 h-6" />
      </span>
    )}
  </Tippy>
);
