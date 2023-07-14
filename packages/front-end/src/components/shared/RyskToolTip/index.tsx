import type { RyskToolTipProps } from "./types";

import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";

import { Info } from "src/Icons";

export const RyskTooltip = ({
  children,
  disabled = false,
  content,
  placement = "auto",
}: RyskToolTipProps) => (
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
