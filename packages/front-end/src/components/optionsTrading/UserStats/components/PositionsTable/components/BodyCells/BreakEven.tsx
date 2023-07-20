import type { BreakEvenProps } from "./types";

import { RyskCountUp } from "src/components/shared/RyskCountUp";

export const BreakEven = ({ breakEven }: BreakEvenProps) => (
  <td className="font-dm-mono">
    <RyskCountUp value={breakEven} />
  </td>
);
