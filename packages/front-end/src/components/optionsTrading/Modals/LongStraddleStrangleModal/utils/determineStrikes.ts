import { StrikeOptions } from "src/state/types";

import { Convert } from "src/utils/Convert";

export const determineStrikes = (
  ethPrice: number,
  isStrangle: boolean,
  strikes: [string, StrikeOptions][]
) => {
  return strikes.reduce(
    ([puts, calls]: [string[], string[]], [strike, strikeOptions]) => {
      const strikeInt = Convert.fromStr(strike).toInt();

      if (isStrangle) {
        const { put, call } = strikeOptions;

        if (
          strikeInt <= ethPrice &&
          !put?.buy.disabled &&
          put?.buy.quote.quote
        ) {
          puts.push(strike);
        }

        if (
          strikeInt >= ethPrice &&
          !call?.buy.disabled &&
          call?.buy.quote.quote
        ) {
          calls.push(strike);
        }
      } else {
        // Determine strike density and ether filter by $100 or $50 on straddles.
        const range = strikes.some(([strike]) => Convert.fromStr(strike).toInt() % 100)
          ? 50
          : 100;
        const lowerBound = ethPrice - range;
        const upperBound = ethPrice + range;

        if (strikeInt >= lowerBound && strikeInt <= upperBound) {
          calls.push(strike);
          puts.push(strike);
        }
      }

      return [puts, calls] as [string[], string[]];
    },
    [[], []]
  );
};
