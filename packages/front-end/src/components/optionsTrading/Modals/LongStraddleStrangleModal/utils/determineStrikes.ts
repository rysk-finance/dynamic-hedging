import { StrikeOptions } from "src/state/types";

export const determineStrikes = (
  ethPrice: number,
  isStrangle: boolean,
  strikes: [string, StrikeOptions][]
) => {
  return strikes.reduce(
    ([calls, puts]: [string[], string[]], [strike, strikeOptions]) => {
      const strikeInt = parseInt(strike);

      if (isStrangle) {
        const { call, put } = strikeOptions;

        if (
          strikeInt >= ethPrice &&
          !call?.buy.disabled &&
          call?.buy.quote.quote
        ) {
          calls.push(strike);
        }

        if (
          strikeInt <= ethPrice &&
          !put?.buy.disabled &&
          put?.buy.quote.quote
        ) {
          puts.push(strike);
        }
      } else {
        // Determine strike density and ether filter by $100 or $50 on straddles.
        const range = strikes.some(([strike]) => parseInt(strike) % 100)
          ? 50
          : 100;
        const lowerBound = ethPrice - range;
        const upperBound = ethPrice + range;

        if (strikeInt >= lowerBound && strikeInt <= upperBound) {
          calls.push(strike);
          puts.push(strike);
        }
      }

      return [calls, puts] as [string[], string[]];
    },
    [[], []]
  );
};
