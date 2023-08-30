import type { HTMLAttributes } from "react";

import type { CallOrPut } from "src/state/types";

interface SymbolProps extends HTMLAttributes<HTMLDivElement> {
  callOrPut?: CallOrPut;
  expiry: string;
  strategyName?: string;
  strike?: number;
}

export const Symbol = ({
  callOrPut,
  children,
  className = "",
  expiry,
  strategyName,
  strike,
}: SymbolProps) => {
  const strikeFormatted = strike ? `$${strike}` : "";
  const callOrPutFormatted = callOrPut || strategyName || "";
  const divPadding = children ? "pt-3" : "py-3";

  return (
    <div
      className={`bg-white border-b-2 border-black font-dm-mono ${divPadding} ${className}`}
    >
      <p className="text-center">
        {`ETH ${expiry} ${strikeFormatted} ${callOrPutFormatted}`.toUpperCase()}
      </p>

      {children}
    </div>
  );
};
