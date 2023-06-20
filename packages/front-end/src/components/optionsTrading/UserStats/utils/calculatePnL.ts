import type { UserPositionToken, WethOracleHashMap } from "src/state/types";

import dayjs from "dayjs";

import { getQuotes } from "src/components/shared/utils/getQuote";
import {
  fromOpyn,
  fromOpynToNumber,
  fromWeiToInt,
  tFormatEth,
  tFormatUSDC,
  toRysk,
} from "src/utils/conversion-helper";

/**
 * Calculate P/L value for all historical positions.
 *
 * @param ethPrice - Ether price from global state.
 * @param longs - List of historical user long positions.
 * @param shorts - List of historical user short positions.
 * @param wethOracleHashMap - Oracle Ether price HashMap from global state.
 *
 * @returns Promise<number>
 */
export const calculatePnL = async (
  ethPrice: number,
  longs: UserPositionToken[] = [],
  shorts: UserPositionToken[] = [],
  wethOracleHashMap: WethOracleHashMap
): Promise<number> => {
  const allPositions = [...longs, ...shorts];

  if (!allPositions.length) return 0;

  const quotes = await getQuotes(
    allPositions.map(
      ({ collateralAsset, expiryTimestamp, isPut, netAmount, strikePrice }) => {
        const isShort = collateralAsset && "symbol" in collateralAsset;

        return {
          expiry: parseInt(expiryTimestamp),
          strike: toRysk(fromOpyn(strikePrice)),
          isPut: isPut,
          orderSize: Math.abs(fromWeiToInt(netAmount)),
          isSell: !isShort,
          collateral: isShort ? collateralAsset.symbol : "USDC",
        };
      }
    )
  );

  return allPositions.reduce(
    (
      totalPnL: number,
      {
        active,
        collateralAsset,
        expiryTimestamp,
        isPut,
        liquidateActions,
        realizedPnl,
        strikePrice,
      },
      index
    ) => {
      if (index < longs.length) {
        // Longs
        const expiriesAt = parseInt(expiryTimestamp);
        const nowToUnix = dayjs().unix();
        const realizedPnL = tFormatUSDC(realizedPnl);

        if (!active) {
          // Manually closed or expired and redeemed.
          return totalPnL + realizedPnL;
        } else if (expiriesAt > nowToUnix) {
          // Open positions.
          const { quote } = quotes[index];

          return totalPnL + realizedPnL + quote;
        } else {
          // Expired but not yet redeemed.
          const priceAtExpiry = wethOracleHashMap[expiryTimestamp];
          const strike = fromOpynToNumber(strikePrice);

          const valueAtExpiry = isPut
            ? strike - priceAtExpiry
            : priceAtExpiry - strike;

          return totalPnL + realizedPnL + valueAtExpiry;
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
          return totalPnL + realizedPnL;
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

          return totalPnL + realizedPnL - collateralLost;
        } else if (expiriesAt > nowToUnix) {
          // Open positions.
          const { quote } = quotes[index];

          return totalPnL + realizedPnL - quote;
        } else {
          // Expired but not yet settled.
          const priceAtExpiry = wethOracleHashMap[expiryTimestamp];
          const strike = fromOpynToNumber(strikePrice);

          if (
            (priceAtExpiry > strike && isPut) ||
            (priceAtExpiry < strike && !isPut)
          ) {
            return totalPnL + realizedPnL;
          }

          const valueAtExpiry = isPut
            ? strike - priceAtExpiry
            : priceAtExpiry - strike;

          return totalPnL + realizedPnL - valueAtExpiry;
        }
      }
    },
    0
  );
};
