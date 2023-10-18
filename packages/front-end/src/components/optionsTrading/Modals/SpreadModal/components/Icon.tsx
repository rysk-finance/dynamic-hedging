import type { ModalProps } from "../types";

import { BearishSpread, BullishSpread } from "src/Icons/Strategy";

import { OptionChainModalActions } from "src/state/types";

export const Icon = ({ strategy }: ModalProps) => {
  const Icon =
    strategy === OptionChainModalActions.CALL_CREDIT_SPREAD ||
    strategy === OptionChainModalActions.PUT_DEBIT_SPREAD
      ? BearishSpread
      : BullishSpread;

  return (
    <div className="bg-white w-1/5 border-black border-b-2">
      <Icon className="w-20 h-20 m-auto pt-1" />
    </div>
  );
};
