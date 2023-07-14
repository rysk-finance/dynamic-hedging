import type {
  InactivePositions,
  UserPositions,
  WethOracleHashMap,
} from "src/state/types";

import {
  fromWeiToInt,
  tFormatUSDC,
  truncate,
} from "src/utils/conversion-helper";

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
        totalPremium,
        netAmount,
        liquidateActions,
      }) => {
        const [, ...series] = symbol.split("-");
        const isShort = Boolean(collateralAsset && "symbol" in collateralAsset);
        const amount = fromWeiToInt(buyAmount || sellAmount || netAmount);
        const liquidated = liquidateActions && liquidateActions.length;
        const redeemed = redeemActions && redeemActions.length;
        const settled = settleActions && settleActions.length;
        const oraclePrice =
          liquidated || redeemed || settled
            ? 0
            : truncate(wethOracleHashMap[expiryTimestamp] || 0);

        return {
          entry: Math.abs(truncate(totalPremium / amount)),
          id: `${id}-${totalPremium}`,
          isShort,
          oraclePrice,
          profitLoss: liquidated ? undefined : tFormatUSDC(realizedPnl),
          series: series.join("-"),
          size: Math.abs(amount),
        };
      }
    );
};
