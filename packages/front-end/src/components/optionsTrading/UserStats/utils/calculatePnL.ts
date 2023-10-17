import type { QuoteData } from "src/components/shared/utils/getQuote/types";
import type { UserPositionToken, WethOracleHashMap } from "src/state/types";

import dayjs from "dayjs";

import { Convert } from "src/utils/Convert";

/**
 * Calculate P/L value for all historical positions.
 * Index 0 - Historical P/L.
 * Index 1 - Active P/L.
 *
 * @param ethPrice - Ether price from global state.
 * @param activePositions - List of active user positions.
 * @param longPositions - List of historical user long positions.
 * @param shortPositions - List of historical user short positions.
 * @param quotes - List of quote data for active positions.
 * @param wethOracleHashMap - Oracle Ether price HashMap from global state.
 *
 * @returns Promise<[number, number]>
 */
export const calculatePnL = async (
  ethPrice: number,
  activePositions: UserPositionToken[] = [],
  longPositions: UserPositionToken[] = [],
  shortPositions: UserPositionToken[] = [],
  quotes: QuoteData[],
  collateralQuotes: QuoteData[],
  wethOracleHashMap: WethOracleHashMap
): Promise<[number, number]> => {
  const allPositions = [...longPositions, ...shortPositions];

  if (!allPositions.length || !ethPrice) return [0, 0];

  return allPositions.reduce(
    (
      [historicalPnL, activePnL],
      {
        active,
        buyAmount,
        collateralAsset,
        expiryTimestamp,
        id,
        isPut,
        liquidateActions,
        netAmount,
        realizedPnl,
        sellAmount,
        strikePrice,
        totalPremiumBought,
        totalPremiumSold,
        vault,
      },
      index
    ) => {
      const positionSize = Convert.fromWei(netAmount).toInt();

      if (index < longPositions.length) {
        // Longs
        const expiriesAt = Convert.fromStr(expiryTimestamp).toInt();
        const nowToUnix = dayjs().unix();
        const realizedPnL = Convert.fromUSDC(realizedPnl).toInt();

        const net = Math.abs(Convert.fromWei(netAmount).toInt());
        const bought = Convert.fromWei(buyAmount || "0").toInt();
        const entry = totalPremiumBought / bought;
        const adjustedPnl = bought > net ? -(net * entry) : realizedPnL;

        if (!active) {
          // Manually closed or expired and redeemed.
          return [historicalPnL + realizedPnL, activePnL];
        } else if (expiriesAt > nowToUnix) {
          // Open positions.
          const { quote } =
            quotes[
              activePositions.findIndex(
                (pos) => pos.id === id && !pos.collateralAsset?.symbol
              )
            ];
          const value = adjustedPnl + quote;

          return [historicalPnL + value, activePnL + value];
        } else {
          // Expired but not yet redeemed.
          const priceAtExpiry = wethOracleHashMap[expiryTimestamp];
          const strike = Convert.fromOpyn(strikePrice).toInt();

          const valueAtExpiry = isPut
            ? Math.max(strike - priceAtExpiry, 0)
            : Math.max(priceAtExpiry - strike, 0);

          return [
            historicalPnL + adjustedPnl + valueAtExpiry * positionSize,
            activePnL,
          ];
        }
      } else {
        // Shorts
        const expiriesAt = Convert.fromStr(expiryTimestamp).toInt();
        const nowToUnix = dayjs().unix();
        const realizedPnL = Convert.fromUSDC(realizedPnl).toInt();
        const hasBeenLiquidated =
          liquidateActions && Boolean(liquidateActions?.length);

        const net = Math.abs(Convert.fromWei(netAmount).toInt());
        const sold = Convert.fromWei(sellAmount || "0").toInt();
        const entry = totalPremiumSold / sold;
        const adjustedPnl = sold > net ? net * entry : realizedPnL;

        // Vault data for collateralised oTokens.
        const vaultCollateral = vault?.longCollateral;
        const vaultRealizedPnL = Convert.fromUSDC(
          vaultCollateral ? vaultCollateral.realizedPnl : "0"
        ).toInt();
        const entryCollateral = vaultCollateral
          ? vaultCollateral.totalPremiumBought /
            Convert.fromWei(sellAmount || "0").toInt()
          : 0;
        const formattedPnlCollateral = Convert.fromUSDC(
          vaultCollateral?.realizedPnl || "0"
        ).toInt();
        const adjustedCollateralPnL =
          sold > net ? -(net * entryCollateral) : formattedPnlCollateral;

        if (!active && !hasBeenLiquidated) {
          // Manually closed or expired and settled.
          return [historicalPnL + realizedPnL + vaultRealizedPnL, activePnL];
        } else if (!active && hasBeenLiquidated) {
          // Liquidated.
          const collateralLost = liquidateActions.reduce(
            (totalCollateral, { collateralPayout }) => {
              const collateralForAction =
                collateralAsset && collateralAsset.symbol === "USDC"
                  ? Convert.fromUSDC(collateralPayout).toInt()
                  : Convert.fromWei(collateralPayout).toInt() * ethPrice;

              return totalCollateral + collateralForAction;
            },
            0
          );

          return [historicalPnL + realizedPnL - collateralLost, activePnL];
        } else if (expiriesAt > nowToUnix) {
          // Open positions.
          const qIndex = activePositions.findIndex(
            (pos) =>
              pos.id === id &&
              pos.collateralAsset?.symbol === collateralAsset?.symbol
          );
          const { quote } = quotes[qIndex];
          const value = adjustedPnl - quote;

          const { quote: collateralQuote } = collateralQuotes[qIndex];
          const collateralValue = adjustedCollateralPnL + collateralQuote;

          return [
            historicalPnL + value + collateralValue,
            activePnL + value + collateralValue,
          ];
        } else {
          // Expired but not yet settled.
          const priceAtExpiry = wethOracleHashMap[expiryTimestamp];
          const strike = Convert.fromOpyn(strikePrice).toInt();
          const collateralStrike = Convert.fromOpyn(
            vaultCollateral?.oToken.strikePrice || strikePrice
          ).toInt();

          const valueAtExpiry = isPut
            ? Math.max(strike - priceAtExpiry, 0)
            : Math.max(priceAtExpiry - strike, 0);
          const valueAtExpiryCollateral = isPut
            ? Math.max(collateralStrike - priceAtExpiry, 0)
            : Math.max(priceAtExpiry - collateralStrike, 0);

          const short = adjustedPnl + valueAtExpiry * positionSize;
          const long =
            adjustedCollateralPnL +
            valueAtExpiryCollateral * Math.abs(positionSize);

          return [historicalPnL + short + long, activePnL];
        }
      }
    },
    [0, 0]
  );
};
