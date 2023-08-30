import type { ModalProps } from "../types";

import { LongStraddle, LongStrangle } from "src/Icons/Strategy";

import { OptionChainModalActions } from "src/state/types";

export const Icon = ({ strategy }: ModalProps) => {
  const Icon =
    strategy === OptionChainModalActions.LONG_STRADDLE
      ? LongStraddle
      : LongStrangle;

  return (
    <div className="bg-white w-1/5 border-black border-b-2">
      <Icon className="w-24 h-24 mx-auto" />
    </div>
  );
};
