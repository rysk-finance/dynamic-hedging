import type { MarkProps } from "./types";

import { RyskCountUp } from "src/components/shared/RyskCountUp";

export const Mark = ({ mark }: MarkProps) => (
  <td className="font-dm-mono">
    <RyskCountUp value={mark} />
  </td>
);
