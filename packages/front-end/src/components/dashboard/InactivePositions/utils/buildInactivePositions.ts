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
        strikePrice,
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

        const strike = Convert.fromOpyn(strikePrice).toInt();
        const strikeCollateral = Convert.fromOpyn(
          vault?.longCollateral?.oToken.strikePrice
        ).toInt();

        const isCreditSpread =
          (isPut && strike > strikeCollateral) ||
          (!isPut && strike < strikeCollateral);

        const closeEntry = isCreditSpread
          ? close - closeCollateral
          : closeCollateral - close;
        const spreadEntry = isCreditSpread
          ? entry - entryCollateral
          : entryCollateral - entry;

        return {
          close: closeCollateral ? closeEntry : close,
          entry: entryCollateral ? spreadEntry : entry,
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
