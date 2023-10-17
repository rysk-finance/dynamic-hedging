import type { ModalProps } from "../types";

import { CallCreditSpread, PutCreditSpread } from "src/Icons/Strategy";

import { OptionChainModalActions } from "src/state/types";

export const Icon = ({ strategy }: ModalProps) => {
  const Icon =
    strategy === OptionChainModalActions.CALL_CREDIT_SPREAD
      ? CallCreditSpread
      : PutCreditSpread;

  return (
    <div className="bg-white w-1/5 border-black border-b-2">
      <Icon className="w-20 h-24 m-auto pt-1" />
    </div>
  );
};
