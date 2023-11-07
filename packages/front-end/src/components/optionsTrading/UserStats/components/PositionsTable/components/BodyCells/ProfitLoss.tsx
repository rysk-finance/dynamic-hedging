import type { ProfitLossProps } from "./types";

import { RyskCountUp } from "src/components/shared/RyskCountUp";

export const ProfitLoss = ({ profitLoss,withFees, suffix }: ProfitLossProps) => {
  const index = Number(!withFees);
  const dynamicClasses = profitLoss[index] < 0 ? "text-red-900" : "text-green-1100";

  return (
    <td className={`font-dm-mono ${dynamicClasses}`}>
      <RyskCountUp value={profitLoss[index]} />
      {suffix}
    </td>
  );
};
