import type { UserPositions } from "src/state/types";
import type { OptionsTransaction, Position } from "../types";

import { tFormatUSDC, truncate } from "src/utils/conversion-helper";

export const getUserPositions = (positions: Position[]): UserPositions => {
  return positions.reduce(
    (
      positions,
      {
        active,
        buyAmount,
        liquidateActions,
        netAmount,
        oToken,
        optionsBoughtTransactions,
        optionsSoldTransactions,
        realizedPnl,
        redeemActions,
        sellAmount,
        settleActions,
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
          const formattedFee = tFormatUSDC(fee);
          const formattedPremium = tFormatUSDC(premium);
          const paid = plusFee
            ? formattedPremium + formattedFee
            : formattedPremium - formattedFee;
          const total = truncate(paid) + acc;

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
        buyAmount,
        liquidateActions,
        netAmount,
        realizedPnl,
        redeemActions,
        sellAmount,
        settleActions,
        totalPremium,
        totalPremiumBought,
        totalPremiumSold,
        vault,
      };

      const hasCollateral = Boolean(token.collateralAsset);
      const key = positions[expiryTimestamp];

      if (!key) {
        positions[expiryTimestamp] = {
          netAmount,
          isLong,
          isShort,
          activeTokens: active ? [token] : [],
          inactiveTokens: !active ? [token] : [],
          longTokens: hasCollateral ? [] : [token],
          shortTokens: hasCollateral ? [token] : [],
        };
      } else {
        positions[expiryTimestamp] = {
          ...key,
          isLong: key.isLong || isLong,
          isShort: key.isShort || isShort,
          activeTokens: active
            ? [...key.activeTokens, token]
            : key.activeTokens,
          inactiveTokens: !active
            ? [...key.inactiveTokens, token]
            : key.inactiveTokens,
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
