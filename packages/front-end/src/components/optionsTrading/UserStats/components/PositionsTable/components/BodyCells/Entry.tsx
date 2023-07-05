import type { EntryProps } from "./types";

import { RyskCountUp } from "src/components/shared/RyskCountUp";

export const Entry = ({ entry }: EntryProps) => (
  <td className="font-dm-mono">
    <RyskCountUp value={entry} />
  </td>
);
