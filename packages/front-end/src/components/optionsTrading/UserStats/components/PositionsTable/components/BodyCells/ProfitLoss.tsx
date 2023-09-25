import type { ProfitLossProps } from "./types";

import { RyskCountUp } from "src/components/shared/RyskCountUp";

export const ProfitLoss = ({ profitLoss, suffix }: ProfitLossProps) => {
  const dynamicClasses = profitLoss < 0 ? "text-red-900" : "text-green-1100";

  return (
    <td className={`font-dm-mono ${dynamicClasses}`}>
      <RyskCountUp value={profitLoss} />
      {suffix}
    </td>
  );
};
