import { LongStraddle, LongStrangle } from "src/Icons/Strategy";
import { OptionChainModalActions } from "src/state/types";

export const strategyList = [
  {
    description: "Works when price moves up or down.",
    Icon: LongStraddle,
    label: "Long Straddle",
    modal: OptionChainModalActions.LONG_STRADDLE,
  },
  // {
  //   description: "Works best when price trades in a defined range.",
  //   Icon: ShortStraddle,
  //   label: "Short Straddle",
  // },
  {
    description: "Works when price moves up or down.",
    Icon: LongStrangle,
    label: "Long Strangle",
    modal: OptionChainModalActions.LONG_STRANGE,
  },
  // {
  //   description: "Works best when price trades in a defined range.",
  //   Icon: ShortStrangle,
  //   label: "Short Strangle",
  // },
];
