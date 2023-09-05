import type { UserPositions } from "src/state/types";
import type { OptionsTransaction, Position } from "../types";

import { truncate } from "src/utils/conversion-helper";
import { Convert } from "src/utils/Convert";

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
        optionsBoughtTransactions: bought,
        optionsSoldTransactions: sold,
        realizedPnl,
        redeemActions,
        sellAmount,
        settleActions,
        vault,
      }
    ) => {
      const { expiryTimestamp } = oToken;

      const isLong = !vault;
      const isShort = Boolean(vault);

      const _getPremium = (
        transactions: OptionsTransaction[],
        plusFee: boolean
      ) => {
        return transactions.reduce((acc, { fee, premium }) => {
          const formattedFee = Convert.fromUSDC(fee).toInt;
          const formattedPremium = Convert.fromUSDC(premium).toInt;
          const paid = plusFee
            ? formattedPremium + formattedFee
            : formattedPremium - formattedFee;
          const total = truncate(paid) + acc;

          return total;
        }, 0);
      };

      const totalPremiumBought = _getPremium(bought, true);
      const totalPremiumSold = _getPremium(sold, false);

      const firstCreated = isShort ? sold[0].timestamp : bought[0].timestamp;

      const token = {
        ...oToken,
        active,
        buyAmount,
        firstCreated,
        liquidateActions,
        netAmount,
        realizedPnl,
        redeemActions,
        sellAmount,
        settleActions,
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
