import type {
  InactivePositions,
  UserPositions,
  WethOracleHashMap,
} from "src/state/types";

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
        isPut,
        realizedPnl,
        redeemActions,
        sellAmount,
        settleActions,
        symbol,
        totalPremiumBought,
        totalPremiumSold,
        netAmount,
        liquidateActions,
        vault,
      }) => {
        const [, ...series] = symbol.split("-");
        const isShort = Boolean(collateralAsset && "symbol" in collateralAsset);
        const amount = Convert.fromWei(
          buyAmount || sellAmount || netAmount
        ).toInt();
        const entryPremium = isShort ? totalPremiumSold : totalPremiumBought;
        const entry = Math.abs(entryPremium / amount);
        const closePremium = isShort ? totalPremiumBought : totalPremiumSold;
        const close = Math.abs(closePremium / amount);
        const liquidated = Boolean(liquidateActions && liquidateActions.length);
        const redeemed = Boolean(redeemActions && redeemActions.length);
        const settled = Boolean(settleActions && settleActions.length);
        const oraclePrice =
          liquidated || (!redeemed && !settled)
            ? 0
            : Convert.round(wethOracleHashMap[expiryTimestamp] || 0);
        const intRealizedPnL = Convert.fromUSDC(realizedPnl).toInt();

        // Data for the long collateral on a spread.
        const longCollateral = vault?.longCollateral;
        const [, ...seriesCollateral] = longCollateral
          ? longCollateral.oToken.symbol.split("-")
          : [""];
        const entryCollateral = longCollateral
          ? longCollateral.totalPremiumBought / amount
          : 0;
        const closeCollateral = longCollateral
          ? longCollateral.totalPremiumSold / amount
          : 0;
        const realizedPnlCollateral = Convert.fromUSDC(
          longCollateral ? longCollateral?.realizedPnl : "0"
        ).toInt();

        const isCreditSpread = vault?.collateralAmount !== null;

        return {
          close: closeCollateral ? (close + closeCollateral) / 2 : close,
          entry: entryCollateral ? (entry + entryCollateral) / 2 : entry,
          id: `${id}-${isShort ? totalPremiumSold : totalPremiumBought}`,
          isCreditSpread,
          isPut,
          isShort,
          oraclePrice,
          profitLoss: liquidated
            ? undefined
            : intRealizedPnL + realizedPnlCollateral,
          series: [series.join("-"), seriesCollateral.join("-")],
          size: Math.abs(amount),
        };
      }
    );
};
