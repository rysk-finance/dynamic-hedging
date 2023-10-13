import type { ModalProps } from "../types";

import { OptionChainModalActions, StrikeOptions } from "src/state/types";

export const getAvailableStrikes = (
  strikes: [string, StrikeOptions][],
  selectedStrikes: [number, number],
  strategy: ModalProps["strategy"],
  isPut: boolean
) => {
  const [selectedShort, selectedLong] = selectedStrikes;
  const isBearishSpread =
    strategy === OptionChainModalActions.CALL_CREDIT_SPREAD ||
    strategy === OptionChainModalActions.PUT_DEBIT_SPREAD;

  return strikes.reduce(
    ([short, long]: [string[], string[]], [strike, strikeOptions]) => {
      const strikeInt = parseInt(strike);
      const { call, put } = strikeOptions;

      const longCallSelectable = !call?.buy.disabled && call?.buy.quote.quote;
      const shortCallSelectable =
        !call?.sell.disabled &&
        !call?.sell.premiumTooSmall &&
        call?.sell.quote.quote;

      const longPutSelectable = !put?.buy.disabled && put?.buy.quote.quote;
      const shortPutSelectable =
        !put?.sell.disabled &&
        !put?.sell.premiumTooSmall &&
        put?.sell.quote.quote;

      const longSelectable = isPut ? longPutSelectable : longCallSelectable;
      const shortSelectable = isPut ? shortPutSelectable : shortCallSelectable;

      if (isBearishSpread) {
        if ((!selectedLong || strikeInt < selectedLong) && shortSelectable) {
          short.push(strike);
        }

        if ((!selectedShort || strikeInt > selectedShort) && longSelectable) {
          long.push(strike);
        }
      } else {
        if ((!selectedLong || strikeInt > selectedLong) && shortSelectable) {
          short.push(strike);
        }

        if ((!selectedShort || strikeInt < selectedShort) && longSelectable) {
          long.push(strike);
        }
      }

      return [short, long] as [string[], string[]];
    },
    [[], []]
  );
};
