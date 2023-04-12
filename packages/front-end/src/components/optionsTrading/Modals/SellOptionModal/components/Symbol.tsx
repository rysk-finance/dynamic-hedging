import type { SymbolProps } from "../types";

export const Symbol = ({ positionData }: SymbolProps) => {
  return (
    <p className="text-center py-4 bg-white border-b-2 border-black font-dm-mono" id="sell-symbol">
      {`ETH ${positionData.expiry} $${positionData.strike} ${positionData.callOrPut}`.toUpperCase()}
    </p>
  );
};
