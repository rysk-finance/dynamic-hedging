import type {
  InactivePositions,
  UserPositions,
  WethOracleHashMap,
} from "src/state/types";

import { fromWeiToInt, truncate } from "src/utils/conversion-helper";
import { Convert } from "src/utils/Convert";

export const buildInactivePositions = (
  userPositions: UserPositions,
  wethOracleHashMap: WethOracleHashMap
): InactivePositions[] => {
  return Object.values(userPositions)
    .flatMap(({ inactiveTokens }) => inactiveTokens)
    .reverse()
    .map(
      ({
        buyAmount,
        collateralAsset,
        expiryTimestamp,
        id,
        realizedPnl,
        redeemActions,
        sellAmount,
        settleActions,
        symbol,
        totalPremiumBought,
        totalPremiumSold,
        netAmount,
        liquidateActions,
      }) => {
        const [, ...series] = symbol.split("-");
        const isShort = Boolean(collateralAsset && "symbol" in collateralAsset);
        const amount = fromWeiToInt(buyAmount || sellAmount || netAmount);
        const entryPremium = isShort ? totalPremiumSold : totalPremiumBought;
        const closePremium = isShort ? totalPremiumBought : totalPremiumSold;
        const liquidated = Boolean(liquidateActions && liquidateActions.length);
        const redeemed = Boolean(redeemActions && redeemActions.length);
        const settled = Boolean(settleActions && settleActions.length);
        const oraclePrice =
          liquidated || (!redeemed && !settled)
            ? 0
            : truncate(wethOracleHashMap[expiryTimestamp] || 0);

        return {
          close: Math.abs(truncate(closePremium / amount)),
          entry: Math.abs(truncate(entryPremium / amount)),
          id: `${id}-${isShort ? totalPremiumSold : totalPremiumBought}`,
          isShort,
          oraclePrice,
          profitLoss: liquidated
            ? undefined
            : Convert.fromUSDC(realizedPnl).toInt,
          series: series.join("-"),
          size: Math.abs(amount),
        };
      }
    );
};
