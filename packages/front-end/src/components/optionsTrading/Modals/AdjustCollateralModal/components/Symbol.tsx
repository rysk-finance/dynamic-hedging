import type { SymbolProps } from "../types";

export const Symbol = ({ series }: SymbolProps) => (
  <p
    className="text-center py-4 bg-white border-b-2 border-black font-dm-mono"
    id="buy-symbol"
  >
    {series}
  </p>
);
