import { LongStraddle, LongStrangle } from "src/Icons/Strategy";
import { OptionChainModalActions } from "src/state/types";

export const strategyList = [
  {
    description: "Works best when volatility is expected to increase.",
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
    description: "Works best when volatility is expected to increase.",
    Icon: LongStrangle,
    label: "Long Strangle",
    modal: OptionChainModalActions.LONG_STRANGLE,
  },
  // {
  //   description: "Works best when price trades in a defined range.",
  //   Icon: ShortStrangle,
  //   label: "Short Strangle",
  // },
];
