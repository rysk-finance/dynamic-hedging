import type {
  InactivePositions,
  UserPositions,
  WethOracleHashMap,
} from "src/state/types";

import { Convert } from "src/utils/Convert";

const getSeries = (
  series: string,
  strike: number,
  collateralStrike?: number
) => {
  switch (true) {
    case collateralStrike && collateralStrike > strike:
      return `${series}-CCS`;

    case collateralStrike && collateralStrike < strike:
      return `${series}-PCS`;

    default:
      return series;
  }
};

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
        const strikeInt = Convert.fromOpyn(strikePrice).toInt();
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
        const entryCollateral = longCollateral
          ? longCollateral.totalPremiumBought / amount
          : 0;
        const closeCollateral = longCollateral
          ? longCollateral.totalPremiumSold / amount
          : 0;
        const strikeCollateral = Convert.fromOpyn(
          longCollateral ? longCollateral.oToken.strikePrice : "0"
        ).toInt();
        const realizedPnlCollateral = Convert.fromUSDC(
          longCollateral ? longCollateral?.realizedPnl : "0"
        ).toInt();

        return {
          close: closeCollateral ? (close + closeCollateral) / 2 : close,
          entry: entryCollateral ? (entry + entryCollateral) / 2 : entry,
          id: `${id}-${isShort ? totalPremiumSold : totalPremiumBought}`,
          isShort,
          oraclePrice,
          profitLoss: liquidated
            ? undefined
            : intRealizedPnL + realizedPnlCollateral,
          series: getSeries(series.join("-"), strikeInt, strikeCollateral),
          size: Math.abs(amount),
        };
      }
    );
};
