import type { SizeProps } from "./types";

import { RyskCountUp } from "src/components/shared/RyskCountUp";

export const Size = ({ amount }: SizeProps) => (
  <td className="font-dm-mono">{<RyskCountUp value={Math.abs(amount)} />}</td>
);
