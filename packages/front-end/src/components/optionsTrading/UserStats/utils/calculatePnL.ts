import type { QuoteData } from "src/components/shared/utils/getQuote/types";
import type { UserPositionToken, WethOracleHashMap } from "src/state/types";

import dayjs from "dayjs";

import {
  fromOpynToNumber,
  tFormatEth,
  tFormatUSDC,
} from "src/utils/conversion-helper";

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
  ethPrice: number | null,
  activePositions: UserPositionToken[] = [],
  longPositions: UserPositionToken[] = [],
  shortPositions: UserPositionToken[] = [],
  quotes: QuoteData[],
  wethOracleHashMap: WethOracleHashMap
): Promise<[number, number]> => {
  const allPositions = [...longPositions, ...shortPositions];

  if (!allPositions.length || !ethPrice) return [0, 0];

  return allPositions.reduce(
    (
      [historicalPnL, activePnL],
      {
        active,
        collateralAsset,
        expiryTimestamp,
        id,
        isPut,
        liquidateActions,
        realizedPnl,
        strikePrice,
      },
      index
    ) => {
      if (index < longPositions.length) {
        // Longs
        const expiriesAt = parseInt(expiryTimestamp);
        const nowToUnix = dayjs().unix();
        const realizedPnL = tFormatUSDC(realizedPnl);

        if (!active) {
          // Manually closed or expired and redeemed.
          return [historicalPnL + realizedPnL, activePnL];
        } else if (expiriesAt > nowToUnix) {
          // Open positions.
          const { quote } =
            quotes[activePositions.findIndex((pos) => pos.id === id)];
          const value = realizedPnL + quote;

          return [historicalPnL + value, activePnL + value];
        } else {
          // Expired but not yet redeemed.
          const priceAtExpiry = wethOracleHashMap[expiryTimestamp];
          const strike = fromOpynToNumber(strikePrice);

          const valueAtExpiry = isPut
            ? Math.max(strike - priceAtExpiry, 0)
            : Math.max(priceAtExpiry - strike, 0);

          return [historicalPnL + realizedPnL + valueAtExpiry, activePnL];
        }
      } else {
        // Shorts
        const expiriesAt = parseInt(expiryTimestamp);
        const nowToUnix = dayjs().unix();
        const realizedPnL = tFormatUSDC(realizedPnl);
        const hasBeenLiquidated =
          liquidateActions && Boolean(liquidateActions?.length);

        if (!active && !hasBeenLiquidated) {
          // Manually closed or expired and settled.
          return [historicalPnL + realizedPnL, activePnL];
        } else if (!active && hasBeenLiquidated) {
          // Liquidated.
          const collateralLost = liquidateActions.reduce(
            (totalCollateral, { collateralPayout }) => {
              const collateralForAction =
                collateralAsset && collateralAsset.symbol === "USDC"
                  ? tFormatUSDC(collateralPayout)
                  : tFormatEth(collateralPayout) * ethPrice;

              return totalCollateral + collateralForAction;
            },
            0
          );

          return [historicalPnL + realizedPnL - collateralLost, activePnL];
        } else if (expiriesAt > nowToUnix) {
          // Open positions.
          const { quote } =
            quotes[activePositions.findIndex((pos) => pos.id === id)];
          const value = realizedPnL - quote;

          return [historicalPnL + value, activePnL + value];
        } else {
          // Expired but not yet settled.
          const priceAtExpiry = wethOracleHashMap[expiryTimestamp];
          const strike = fromOpynToNumber(strikePrice);

          const valueAtExpiry = isPut
            ? Math.max(strike - priceAtExpiry, 0)
            : Math.max(priceAtExpiry - strike, 0);

          return [historicalPnL + realizedPnL - valueAtExpiry, activePnL];
        }
      }
    },
    [0, 0]
  );
};
