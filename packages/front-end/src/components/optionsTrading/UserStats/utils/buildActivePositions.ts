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
import {
  fromOpyn,
  fromOpynToNumber,
  fromWeiToInt,
  tFormatUSDC,
} from "src/utils/conversion-helper";
import { getLiquidationPrices } from "../../../shared/utils/getLiquidationPrice";
import { PositionAction } from "../enums";

const formatCollateralAmount = (
  fallback: number,
  collateralAsset?: UserPositionToken["collateralAsset"],
  vault?: Vault
) => {
  if (vault && collateralAsset) {
    if (collateralAsset.symbol === "WETH") {
      return fromWeiToInt(vault.collateralAmount);
    } else {
      return tFormatUSDC(vault.collateralAmount);
    }
  } else {
    return fallback;
  }
};

const calculateProfitLoss = (
  amount: number,
  formattedPnl: number,
  isOpen: boolean,
  isPut: boolean,
  isShort: boolean,
  priceAtExpiry: number,
  quote: number,
  strike: number
) => {
  if (isOpen) {
    if (isShort) {
      return formattedPnl - quote;
    } else {
      return formattedPnl + quote;
    }
  }

  const valueAtExpiry = isPut
    ? Math.max(strike - priceAtExpiry, 0)
    : Math.max(priceAtExpiry - strike, 0);

  return formattedPnl + valueAtExpiry * amount;
};

const getAction = (
  disabled: boolean,
  isOpen: boolean,
  isShort: boolean,
  profitLoss: number
) => {
  if (!isOpen && isShort) {
    return PositionAction.SETTLE;
  }

  if (!isOpen) {
    if (profitLoss > 0) {
      return PositionAction.REDEEM;
    } else {
      return PositionAction.BURN;
    }
  }

  if (disabled) {
    return PositionAction.UNTRADEABLE;
  } else {
    return PositionAction.CLOSE;
  }
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
  ethPrice: number | null,
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
          amount: Math.abs(fromWeiToInt(netAmount)),
          callOrPut: isPut ? "put" : "call",
          collateral: formatCollateralAmount(0, collateralAsset, vault),
          collateralAddress:
            (vault?.collateralAsset.id as HexString) || ZERO_ADDRESS,
          expiry: parseInt(expiryTimestamp),
          strikePrice: fromOpynToNumber(strikePrice),
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
      const isOpen = parseInt(expiryTimestamp) > nowToUnix;
      const isShort = Boolean(collateralAsset && "symbol" in collateralAsset);
      const amount = fromWeiToInt(netAmount);
      const entry = isShort
        ? totalPremiumSold / fromWeiToInt(sellAmount || 0)
        : totalPremiumBought / fromWeiToInt(buyAmount || 0);
      const side = isPut ? "put" : "call";
      const strike = fromOpynToNumber(strikePrice);
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
            : { disabled: false, quote: { quote: 0 } },
      };

      // Determine if disabled.
      const disabled = isShort
        ? buy?.disabled || !buy.quote.quote
        : sell?.disabled || !sell.quote.quote;

      // P/L calcs.
      const formattedPnl = tFormatUSDC(realizedPnl);
      const { quote } = quotes[index];
      const priceAtExpiry = wethOracleHashMap[expiryTimestamp];
      const profitLoss = calculateProfitLoss(
        amount,
        formattedPnl,
        isOpen,
        isPut,
        isShort,
        priceAtExpiry,
        quote,
        strike
      );

      return {
        action: getAction(disabled, isOpen, isShort, profitLoss),
        amount,
        breakEven: isPut ? strike - entry : strike + entry,
        collateral: {
          amount: formatCollateralAmount(0, collateralAsset, vault),
          asset: collateralAsset?.symbol,
          liquidationPrice: liquidationPrices[index],
          vault,
        },
        disabled: isOpen && disabled,
        delta: amount * delta,
        entry,
        expiryTimestamp,
        id,
        isOpen,
        isPut,
        isShort,
        mark: (buy.quote.quote + sell.quote.quote) / 2,
        profitLoss,
        series: series.join("-"),
        strike: fromOpyn(strikePrice),
      };
    }
  );
};
