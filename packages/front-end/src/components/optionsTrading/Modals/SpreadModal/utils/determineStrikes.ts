import type { ModalProps } from "../types";

import { OptionChainModalActions, StrikeOptions } from "src/state/types";

export const getAvailableStrikes = (
  strikes: [string, StrikeOptions][],
  selectedStrikes: [number, number],
  strategy: ModalProps["strategy"]
) => {
  const [selectedShort, selectedLong] = selectedStrikes;
  const isBearishSpread =
    strategy === OptionChainModalActions.CALL_CREDIT_SPREAD ||
    strategy === OptionChainModalActions.PUT_DEBIT_SPREAD;

  return strikes.reduce(
    ([short, long]: [string[], string[]], [strike, strikeOptions]) => {
      const strikeInt = parseInt(strike);

      if (isBearishSpread) {
        const { call } = strikeOptions;
        const callSelectable = !call?.buy.disabled && call?.buy.quote.quote;

        if ((!selectedLong || strikeInt < selectedLong) && callSelectable) {
          short.push(strike);
        }

        if ((!selectedShort || strikeInt > selectedShort) && callSelectable) {
          long.push(strike);
        }
      } else {
        const { put } = strikeOptions;
        const putSelectable = !put?.buy.disabled && put?.buy.quote.quote;

        if ((!selectedLong || strikeInt > selectedLong) && putSelectable) {
          short.push(strike);
        }

        if ((!selectedShort || strikeInt < selectedShort) && putSelectable) {
          long.push(strike);
        }
      }

      return [short, long] as [string[], string[]];
    },
    [[], []]
  );
};
