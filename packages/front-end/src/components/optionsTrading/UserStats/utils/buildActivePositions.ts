import type { QuoteData } from "src/components/shared/utils/getQuote/types";
import type {
  ActivePositions,
  ChainData,
  SpotShock,
  TimesToExpiry,
  UserPositionToken,
  WethOracleHashMap,
} from "src/state/types";

import dayjs from "dayjs";

import { ZERO_ADDRESS } from "src/config/constants";
import { Vault } from "src/hooks/useInitialData/types";
import { Convert } from "src/utils/Convert";
import { getLiquidationPrices } from "../../../shared/utils/getLiquidationPrice";
import { PositionAction } from "../enums";

const formatCollateralAmount = (
  fallback: number,
  collateralAsset?: UserPositionToken["collateralAsset"],
  vault?: Vault
) => {
  if (vault && collateralAsset) {
    if (collateralAsset.symbol === "WETH") {
      return Convert.fromWei(vault.collateralAmount).toInt();
    } else {
      return Convert.fromUSDC(vault.collateralAmount).toInt();
    }
  } else {
    return fallback;
  }
};

const calculateProfitLoss = (
  amount: number,
  adjustedPnl: number,
  isOpen: boolean,
  isShort: boolean,
  quote: number,
  valueAtExpiry: number
) => {
  if (isOpen) {
    if (isShort) {
      return adjustedPnl - quote;
    } else {
      return adjustedPnl + quote;
    }
  }

  return adjustedPnl + valueAtExpiry * amount;
};

/**
 * Get the first action that can be performed for any position.
 *
 * @param disabled - True if the opposite side is disabled.
 * @param isOpen - True if the position is active.
 * @param isShort - True if the position is short (sold).
 * @param valueAtExpiry - USDC value at the time of expiry.
 * @param premiumTooSmall - Boolean value representing the sell side premiumTooSmall flag.
 * @param exposure - Overall DHV exposure of the series.
 *
 * @returns - String representation of the available action.
 */
const getAction = (
  disabled: boolean,
  isOpen: boolean,
  isShort: boolean,
  valueAtExpiry: number,
  premiumTooSmall: boolean,
  exposure?: number
) => {
  if (!isOpen && isShort) {
    return PositionAction.SETTLE;
  }

  if (!isOpen) {
    if (valueAtExpiry) {
      return PositionAction.REDEEM;
    } else {
      return PositionAction.BURN;
    }
  }

  // Untradeable when:
  // - Is disabled.
  // - Is long with the premiumTooSmall flag up and has no USDC short exposure.
  const shortExposure = exposure ? exposure : 0;
  if (disabled || (!isShort && premiumTooSmall && shortExposure <= 0)) {
    return PositionAction.UNTRADEABLE;
  }

  return PositionAction.CLOSE;
};

/**
 * Calculate table data for all active user positions.
 *
 * @param chainData - Option chain data from global state.
 * @param positions - List of active user positions.
 * @param quotes - List of quote data for active positions.
 * @param ethPrice - Ether price from global state.
 * @param spotShock - A dict of values for all collateral types & flavors.
 * @param timesToExpiry - A dict of values for all collateral types & flavors.
 * @param wethOracleHashMap - Oracle Ether price HashMap from global state.
 *
 * @returns Promise<ActivePositions[]>
 */
export const buildActivePositions = async (
  chainData: ChainData,
  positions: UserPositionToken[] = [],
  quotes: QuoteData[],
  ethPrice: number,
  spotShock: SpotShock,
  timesToExpiry: TimesToExpiry,
  wethOracleHashMap: WethOracleHashMap
): Promise<ActivePositions[]> => {
  if (positions.length === 0 || !ethPrice) return [];

  const nowToUnix = dayjs().unix();

  const liquidationPrices = await getLiquidationPrices(
    positions.map(
      ({
        collateralAsset,
        expiryTimestamp,
        isPut,
        netAmount,
        strikePrice,
        vault,
      }) => {
        return {
          amount: Math.abs(Convert.fromWei(netAmount).toInt()),
          callOrPut: isPut ? "put" : "call",
          collateral: formatCollateralAmount(0, collateralAsset, vault),
          collateralAddress:
            (vault?.collateralAsset.id as HexString) || ZERO_ADDRESS,
          expiry: Convert.fromStr(expiryTimestamp).toInt(),
          strikePrice: Convert.fromOpyn(strikePrice).toInt(),
        };
      }
    ),
    ethPrice,
    spotShock,
    timesToExpiry
  );

  return positions.map(
    (
      {
        buyAmount,
        collateralAsset,
        expiryTimestamp,
        firstCreated,
        id,
        isPut,
        netAmount,
        realizedPnl,
        sellAmount,
        strikePrice,
        symbol,
        totalPremiumBought,
        totalPremiumSold,
        vault,
      },
      index
    ) => {
      const [, ...series] = symbol.split("-");
      const isOpen = Convert.fromStr(expiryTimestamp).toInt() > nowToUnix;
      const isShort = Boolean(collateralAsset && "symbol" in collateralAsset);
      const amount = Convert.fromWei(netAmount).toInt();
      const entry = isShort
        ? totalPremiumSold / Convert.fromWei(sellAmount || "0").toInt()
        : totalPremiumBought / Convert.fromWei(buyAmount || "0").toInt();
      const formattedPnl = Convert.fromUSDC(realizedPnl).toInt();
      const side = isPut ? "put" : "call";
      const strike = Convert.fromOpyn(strikePrice).toInt();
      const chainSideData = chainData[expiryTimestamp]?.[strike][side];
      const { delta, buy, sell } = {
        delta: isOpen && chainSideData?.delta ? chainSideData.delta : 0,
        buy:
          isOpen && chainSideData?.buy
            ? chainSideData.buy
            : { disabled: false, quote: { quote: 0 } },
        sell:
          isOpen && chainSideData?.sell
            ? chainSideData.sell
            : { disabled: false, premiumTooSmall: false, quote: { quote: 0 } },
      };

      // Determine if disabled.
      const disabled = isShort
        ? buy?.disabled || !buy.quote.quote
        : sell?.disabled || !sell.quote.quote;

      // Adjust P/L for partially closed positions.
      const net = Math.abs(amount);
      const bought = Convert.fromWei(buyAmount || "0").toInt();
      const sold = Convert.fromWei(sellAmount || "0").toInt();

      const adjusted =
        isShort && sold > net
          ? net * entry
          : !isShort && bought > net
          ? -(net * entry)
          : formattedPnl;

      // P/L calcs.
      const { quote } = quotes[index];
      const priceAtExpiry = wethOracleHashMap[expiryTimestamp];
      const valueAtExpiry = isPut
        ? Math.max(strike - priceAtExpiry, 0)
        : Math.max(priceAtExpiry - strike, 0);
      const profitLoss = calculateProfitLoss(
        amount,
        adjusted,
        isOpen,
        isShort,
        quote,
        valueAtExpiry
      );
      const returnOnInvestment = Math.max(
        isShort
          ? (profitLoss / adjusted) * 100
          : 0 - (profitLoss / adjusted) * 100,
        -100
      );

      const action = getAction(
        disabled,
        isOpen,
        isShort,
        valueAtExpiry,
        sell.premiumTooSmall,
        chainSideData?.exposure.USDC.short
      );

      return {
        action,
        amount,
        breakEven: isPut ? strike - entry : strike + entry,
        collateral: {
          amount: formatCollateralAmount(0, collateralAsset, vault),
          asset: collateralAsset?.symbol,
          liquidationPrice: liquidationPrices[index],
          vault,
        },
        disabled: action === PositionAction.UNTRADEABLE,
        delta: amount * delta,
        entry,
        expiryTimestamp,
        firstCreated,
        id,
        isOpen,
        isPut,
        isShort,
        mark: (buy.quote.quote + sell.quote.quote) / 2,
        profitLoss,
        returnOnInvestment,
        series: series.join("-"),
        shortUSDCExposure:
          !isShort && sell.premiumTooSmall
            ? chainSideData?.exposure.USDC.short
            : undefined,
        strike: Convert.fromOpyn(strikePrice).toStr(),
      };
    }
  );
};
