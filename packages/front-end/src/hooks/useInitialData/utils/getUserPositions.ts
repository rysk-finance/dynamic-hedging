import type { UserPositions } from "src/state/types";
import type { OptionsTransaction, Position } from "../types";

import dayjs from "dayjs";

import { tFormatUSDC } from "src/utils/conversion-helper";

export const getUserPositions = (positions: Position[]): UserPositions => {
  const now = dayjs().unix();

  return positions.reduce(
    (
      positions,
      {
        active,
        netAmount,
        oToken,
        optionsBoughtTransactions,
        optionsSoldTransactions,
        liquidateActions,
        realizedPnl,
        vault,
      }
    ) => {
      const { expiryTimestamp } = oToken;

      const isLong = Number(netAmount) > 0;
      const isShort = Number(netAmount) < 0;

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
        active,
        netAmount,
        totalPremium,
        liquidateActions,
        realizedPnl,
        vault,
      };

      const isActive = active && parseInt(expiryTimestamp) >= now;
      const hasCollateral = Boolean(token.collateralAsset);
      const key = positions[expiryTimestamp];

      if (!key) {
        positions[expiryTimestamp] = {
          netAmount,
          isLong,
          isShort,
          activeTokens: isActive ? [token] : [],
          longTokens: hasCollateral ? [] : [token],
          shortTokens: hasCollateral ? [token] : [],
        };
      } else {
        positions[expiryTimestamp] = {
          ...key,
          isLong: key.isLong || isLong,
          isShort: key.isShort || isShort,
          activeTokens: isActive
            ? [...key.activeTokens, token]
            : key.activeTokens,
          longTokens: hasCollateral
            ? key.longTokens
            : [...key.longTokens, token],
          shortTokens: hasCollateral
            ? [...key.shortTokens, token]
            : key.shortTokens,
        };
      }

      return positions;
    },
    {} as UserPositions
  );
};
