import type { UserPositions } from "src/state/types";
import type { InitialDataQuery, OptionsTransaction } from "../types";

import { tFormatUSDC } from "src/utils/conversion-helper";

export const getUserPositions = (
  positions: InitialDataQuery["longPositions" | "shortPositions"]
): UserPositions => {
  return positions.reduce(
    (
      positions,
      {
        netAmount,
        oToken,
        optionsBoughtTransactions,
        optionsSoldTransactions,
        vault,
      }
    ) => {
      const { expiryTimestamp } = oToken;
      const isLong = Number(netAmount) > 0;
      const isShort = Number(netAmount) < 0;

      const key = positions[expiryTimestamp];

      const _getPremium = (
        transactions: OptionsTransaction[],
        plusFee: boolean
      ) => {
        return transactions.reduce((acc, { fee, premium }) => {
          const paid = plusFee
            ? Number(premium) + Number(fee)
            : Number(premium) - Number(fee);
          const total = tFormatUSDC(paid, 2) + acc;

          return total;
        }, 0);
      };

      const totalPremiumBought = _getPremium(optionsBoughtTransactions, true);
      const totalPremiumSold = _getPremium(optionsSoldTransactions, false);
      // This figure is only relevant to net long positions so we can display their value.
      const totalPremium = totalPremiumBought - totalPremiumSold;

      const token = {
        ...oToken,
        netAmount,
        totalPremium,
        vault,
      };

      if (!key) {
        positions[expiryTimestamp] = {
          netAmount,
          isLong,
          isShort,
          tokens: [token],
        };
      } else {
        positions[expiryTimestamp] = {
          ...key,
          isLong: key.isLong || isLong,
          isShort: key.isShort || isShort,
          tokens: [...key.tokens, token],
        };
      }

      return positions;
    },
    {} as UserPositions
  );
};
