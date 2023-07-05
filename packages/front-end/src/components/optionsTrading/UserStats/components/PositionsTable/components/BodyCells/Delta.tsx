import type { DeltaProps } from "./types";

import { RyskCountUp } from "src/components/shared/RyskCountUp";

export const Delta = ({ delta }: DeltaProps) => (
  <td className="font-dm-mono">
    <RyskCountUp value={delta} />
  </td>
);
