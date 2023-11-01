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

const calculateBreakEven = (
  entry: number,

  isCreditSpread: boolean,
  isPut: boolean,
  isSpread: boolean,
  spreadEntry: number,
  strikeInt: number,
  strikeIntCollateral: number
) => {
  if (isSpread && isCreditSpread) {
    return isPut ? strikeInt - spreadEntry : strikeInt + spreadEntry;
  }

  if (isSpread) {
    return isPut
      ? strikeIntCollateral - spreadEntry
      : strikeIntCollateral + spreadEntry;
  }

  return isPut ? strikeInt - entry : strikeInt + entry;
};

const formatCollateralAmount = (
  fallback: number,
  collateralAsset?: UserPositionToken["collateralAsset"],
  vault?: Vault
) => {
  if (vault && vault.collateralAmount && collateralAsset) {
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
  adjustedCollateralPnL: number,
  isOpen: boolean,
  isShort: boolean,
  isSpread: boolean,
  quote: number,
  quoteCollateral: number,
  valueAtExpiry: number,
  valueAtExpiryCollateral: number
) => {
  if (isOpen) {
    if (isSpread) {
      return adjustedPnl - quote + (adjustedCollateralPnL + quoteCollateral);
    }

    if (isShort) {
      return adjustedPnl - quote;
    } else {
      return adjustedPnl + quote;
    }
  }

  if (isSpread) {
    const short = adjustedPnl + valueAtExpiry * amount;
    const long =
      adjustedCollateralPnL + valueAtExpiryCollateral * Math.abs(amount);

    return short + long;
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
  isSpread: boolean,
  valueAtExpiry: number,
  premiumTooSmall: boolean,
  exposure?: number,
  collateralExposure?: number
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
  // - Is spread with the premiumTooSmall flag up on the long collateral and has no USDC short exposure.
  const shortExposure = exposure ? exposure : 0;
  const longCollateralExposure = collateralExposure ? collateralExposure : 0;
  if (
    disabled ||
    (!isShort && premiumTooSmall && shortExposure <= 0) ||
    (isSpread && premiumTooSmall && longCollateralExposure <= 0)
  ) {
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
  collateralQuotes: QuoteData[],
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
            (vault?.collateralAsset?.id as HexString) || ZERO_ADDRESS,
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
      // Data for position. In the case of spreads, this is for the short.
      const [, ...series] = symbol.split("-");
      const isOpen = Convert.fromStr(expiryTimestamp).toInt() > nowToUnix;
      const isShort = Boolean(collateralAsset && "symbol" in collateralAsset);
      const isSpread = Boolean(vault?.longCollateral);
      const isCreditSpread = isSpread && Boolean(vault?.collateralAmount);
      const amount = Convert.fromWei(netAmount).toInt();
      const net = Math.abs(amount);
      const entry = isShort
        ? totalPremiumSold / Convert.fromWei(sellAmount || "0").toInt()
        : totalPremiumBought / Convert.fromWei(buyAmount || "0").toInt();
      const formattedPnl = Convert.fromUSDC(realizedPnl).toInt();
      const side = isPut ? "put" : "call";
      const strike = Convert.fromOpyn(strikePrice);
      const strikeInt = strike.toInt();
      const chainSideData = chainData[expiryTimestamp]?.[strikeInt][side];
      const buy =
        isOpen && chainSideData?.buy
          ? chainSideData.buy
          : { disabled: false, quote: { quote: 0 } };
      const sell =
        isOpen && chainSideData?.sell
          ? chainSideData.sell
          : { disabled: false, premiumTooSmall: false, quote: { quote: 0 } };
      const delta = isOpen && chainSideData?.delta ? chainSideData.delta : 0;
      const mark = (buy.quote.quote + sell.quote.quote) / 2;

      // Data for the long collateral on a spread.
      const longCollateral = vault?.longCollateral;
      const [, ...seriesCollateral] = longCollateral
        ? longCollateral.oToken.symbol.split("-")
        : [""];
      const formattedPnlCollateral = Convert.fromUSDC(
        longCollateral?.realizedPnl || "0"
      ).toInt();
      const entryCollateral = longCollateral
        ? longCollateral.totalPremiumBought /
          Convert.fromWei(sellAmount || "0").toInt()
        : 0;
      const expiryCollateral =
        longCollateral?.oToken.expiryTimestamp || expiryTimestamp;
      const sideCollateral =
        (longCollateral?.oToken.isPut ? "put" : "call") || side;
      const strikeCollateral = Convert.fromOpyn(
        longCollateral?.oToken.strikePrice || "0"
      );
      const strikeIntCollateral = strikeCollateral.toInt();
      const chainsSideDataCollateral =
        chainData[expiryCollateral]?.[strikeIntCollateral]?.[sideCollateral];
      const deltaCollateral =
        isOpen && chainsSideDataCollateral?.delta
          ? chainsSideDataCollateral.delta
          : 0;
      const buyCollateral =
        isOpen && chainsSideDataCollateral?.buy
          ? chainsSideDataCollateral.buy
          : { disabled: false, quote: { quote: 0 } };
      const sellCollateral =
        isOpen && chainsSideDataCollateral?.sell
          ? chainsSideDataCollateral.sell
          : { disabled: false, premiumTooSmall: false, quote: { quote: 0 } };
      const markCollateral =
        (buyCollateral.quote.quote + sellCollateral.quote.quote) / 2;

      // Determine if disabled.
      const disabled = isShort
        ? buy.disabled || !buy.quote.quote
        : sell.disabled || !sell.quote.quote;
      const disabledCollateral = isSpread
        ? sellCollateral.disabled || !sellCollateral.quote.quote
        : false;

      // Get net credit/debit for spreads
      const spreadEntry = isCreditSpread
        ? entry - entryCollateral
        : entryCollateral - entry;

      // Get net mark for spreads.
      const spreadMark = isCreditSpread
        ? mark - markCollateral
        : markCollateral - mark;

      // Adjust P/L for partially closed positions.
      const bought = Convert.fromWei(buyAmount || "0").toInt();
      const sold = Convert.fromWei(sellAmount || "0").toInt();

      const adjusted =
        isShort && sold > net
          ? net * entry
          : !isShort && bought > net
          ? -(net * entry)
          : formattedPnl;

      const adjustedCollateral =
        isSpread && sold > net
          ? -(net * entryCollateral)
          : formattedPnlCollateral;

      // P/L calcs.
      const { quote } = quotes[index];
      const { quote: quoteCollateral } = collateralQuotes[index];
      const priceAtExpiry = wethOracleHashMap[expiryTimestamp];
      const valueAtExpiry = isPut
        ? Math.max(strikeInt - priceAtExpiry, 0)
        : Math.max(priceAtExpiry - strikeInt, 0);
      const valueAtExpiryCollateral = isPut
        ? Math.max(strikeIntCollateral - priceAtExpiry, 0)
        : Math.max(priceAtExpiry - strikeIntCollateral, 0);
      const profitLoss = calculateProfitLoss(
        amount,
        adjusted,
        adjustedCollateral,
        isOpen,
        isShort,
        isSpread,
        quote,
        quoteCollateral,
        valueAtExpiry,
        valueAtExpiryCollateral
      );
      const totalPaid = net * ((entry + entryCollateral) / 2);
      const returnOnInvestment =
        Math.max(
          isShort
            ? profitLoss /
                formatCollateralAmount(totalPaid, collateralAsset, vault)
            : profitLoss / (amount * entry),
          -1
        ) * 100;

      const action = getAction(
        disabled || disabledCollateral,
        isOpen,
        isShort,
        isSpread,
        valueAtExpiry,
        isSpread ? sellCollateral.premiumTooSmall : sell.premiumTooSmall,
        chainSideData?.exposure.USDC.short,
        chainsSideDataCollateral?.exposure.USDC.short
      );

      return {
        action,
        amount,
        breakEven: calculateBreakEven(
          entry,
          isCreditSpread,
          isPut,
          isSpread,
          spreadEntry,
          strikeInt,
          strikeIntCollateral
        ),
        collateral: {
          amount: formatCollateralAmount(0, collateralAsset, vault),
          asset: collateralAsset?.symbol,
          liquidationPrice: liquidationPrices[index],
          vault,
        },
        disabled: action === PositionAction.UNTRADEABLE,
        delta: isSpread
          ? deltaCollateral * net + delta * amount
          : delta * amount,
        entry: entryCollateral ? spreadEntry : entry,
        expiryTimestamp,
        firstCreated,
        id,
        isCreditSpread,
        isOpen,
        isPut,
        isShort,
        isSpread,
        longCollateralAddress: longCollateral?.oToken.id,
        mark: markCollateral ? spreadMark : mark,
        profitLoss,
        returnOnInvestment,
        series: [series.join("-"), seriesCollateral.join("-")],
        shortUSDCExposure:
          !isShort && sell.premiumTooSmall
            ? chainSideData?.exposure.USDC.short
            : isSpread && sellCollateral.premiumTooSmall
            ? chainsSideDataCollateral?.exposure.USDC.short
            : undefined,
        strikes: [strike.toStr(), isSpread ? strikeCollateral.toStr() : ""],
      };
    }
  );
};
