import type { UserPositions } from "src/state/types";
import type { LongCollateralMap, OptionsTransaction, Position } from "../types";

import { Convert } from "src/utils/Convert";

export const getUserPositions = (
  positions: Position[],
  longCollateralMap: LongCollateralMap
): UserPositions => {
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
          const formattedFee = Convert.fromUSDC(fee).toInt();
          const formattedPremium = Convert.fromUSDC(premium).toInt();
          const paid = plusFee
            ? formattedPremium + formattedFee
            : formattedPremium - formattedFee;
          const total = Convert.round(paid) + acc;

          return total;
        }, 0);
      };

      const totalPremiumBought = _getPremium(bought, true);
      const totalPremiumSold = _getPremium(sold, false);

      const firstCreated = isShort ? sold[0].timestamp : bought[0].timestamp;

      // Get total premiums for long oTokens used as collateral where relevant.
      const longCollateral = vault
        ? longCollateralMap[vault.vaultId]
        : undefined;
      const totalPremiumBoughtCollateral = longCollateral
        ? _getPremium(longCollateral.optionsBoughtTransactions, true)
        : 0;
      const totalPremiumSoldCollateral = longCollateral
        ? _getPremium(longCollateral.optionsSoldTransactions, false)
        : 0;

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
        vault: vault
          ? {
              ...vault,
              longCollateral: longCollateral
                ? {
                    ...longCollateral,
                    totalPremiumBought: totalPremiumBoughtCollateral,
                    totalPremiumSold: totalPremiumSoldCollateral,
                  }
                : undefined,
            }
          : undefined,
      };

      const hasCollateral = Boolean(token.collateralAsset);
      const key = positions[expiryTimestamp];

      if (!key) {
        positions[expiryTimestamp] = {
          netAmount,
          isLong: isLong && active,
          isShort: isShort && active,
          activeTokens: active ? [token] : [],
          inactiveTokens: !active ? [token] : [],
          longTokens: hasCollateral ? [] : [token],
          shortTokens: hasCollateral ? [token] : [],
        };
      } else {
        positions[expiryTimestamp] = {
          ...key,
          isLong: key.isLong || (isLong && active),
          isShort: key.isShort || (isShort && active),
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
