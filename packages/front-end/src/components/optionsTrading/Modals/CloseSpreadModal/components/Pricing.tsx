import type { PricingProps } from "../types";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";

import FadeInOutQuick from "src/animation/FadeInOutQuick";
import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { RyskTooltip } from "src/components/shared/RyskToolTip";
import { useGlobalContext } from "src/state/GlobalContext";
import { OptionChainModalActions } from "src/state/types";
import { Symbol } from "../../Shared/components/Symbol";
import { MAX_TRADE_SIZE, MIN_TRADE_SIZE } from "../../Shared/utils/constants";

export const Pricing = ({ positionData, size }: PricingProps) => {
  const {
    state: {
      options: {
        liquidityPool: { utilisationHigh },
      },
      userTradingPreferences: { tutorialMode },
    },
  } = useGlobalContext();

  const {
    collateralReleased,
    collateralType,
    fee,
    hasRequiredCapital,
    isCredit,
    isPut,
    now,
    quotes,
    remainingBalance,
    remainingCollateral,
    slippage,
    strikes,
  } = positionData;

  const [shortQuote, longQuote] = quotes;

  const strategyName = isPut
    ? isCredit
      ? OptionChainModalActions.PUT_CREDIT_SPREAD
      : OptionChainModalActions.PUT_DEBIT_SPREAD
    : isCredit
    ? OptionChainModalActions.CALL_CREDIT_SPREAD
    : OptionChainModalActions.CALL_DEBIT_SPREAD;

  const errorMessage = useMemo(() => {
    switch (true) {
      case size && Number(size) < MIN_TRADE_SIZE:
      case size && Number(size) > MAX_TRADE_SIZE:
        return "Trade size must be between 0.1 and 1000.";

      case !hasRequiredCapital && Boolean(quotes[0]):
        return "Insufficient balance to cover collateral.";

      case remainingBalance <= 0 && Boolean(quotes[0]):
        return "Final balance cannot be negative.";

      case utilisationHigh:
        return "DHV utilisation is high. Some TXs may fail.";

      default:
        return "";
    }
  }, [positionData]);

  return (
    <div className="flex flex-col">
      <Symbol
        {...positionData}
        strategyName={strategyName}
        strike={Number(strikes && strikes[0])}
      />

      <div className="w-4/5 xl:w-3/5 mx-auto py-2">
        <span className="flex">
          <p className="mr-auto">
            {isCredit ? "Net premium paid:" : "Net premium received:"}
          </p>
          <RyskTooltip
            content="The amount of USDC received per contract."
            disabled={!tutorialMode}
            placement="left"
          >
            <p className="font-medium">
              <RyskCountUp
                value={
                  isCredit ? shortQuote - longQuote : longQuote - shortQuote
                }
              />
              {` USDC`}
            </p>
          </RyskTooltip>
        </span>

        <span className="flex">
          <p className="mr-auto">{`Price impact:`}</p>
          <RyskTooltip
            content="The slippage of total premium based on trade size."
            disabled={!tutorialMode}
            placement="left"
          >
            <p className="font-medium">
              <RyskCountUp value={slippage} />
              {` %`}
            </p>
          </RyskTooltip>
        </span>

        <span className="flex pb-2">
          <p className="mr-auto">{`Total fee:`}</p>
          <RyskTooltip
            content="The total fee that Rysk collects per contract."
            disabled={!tutorialMode}
            placement="left"
          >
            <p className="font-medium">
              <RyskCountUp value={Number(size) * fee} />
              {` USDC`}
            </p>
          </RyskTooltip>
        </span>

        {isCredit && (
          <>
            <span className="flex pt-2 border-gray-600 border-t">
              <p className="mr-auto">{`Collateral released:`}</p>
              <RyskTooltip
                content="The total amount of collateral you will receive back."
                disabled={!tutorialMode}
                placement="left"
              >
                <p className="font-medium">
                  <RyskCountUp
                    format={collateralType === "USDC" ? "USD" : "ETH"}
                    value={collateralReleased}
                  />
                  {collateralType === "USDC" ? ` USDC` : ` WETH`}
                </p>
              </RyskTooltip>
            </span>

            <span className="flex pb-2 border-gray-600 border-b">
              <p className="mr-auto">{`Collateral remaining:`}</p>
              <RyskTooltip
                content="The total amount of collateral that will remain in the vault for this position."
                disabled={!tutorialMode}
                placement="left"
              >
                <p className="font-medium">
                  <RyskCountUp value={remainingCollateral} />
                  {" USDC"}
                </p>
              </RyskTooltip>
            </span>
          </>
        )}

        <div>
          <span className="flex pt-2 border-gray-600 border-t">
            <p className="mr-auto">{`Balances after:`}</p>
            <p className="font-medium">
              <RyskCountUp value={remainingBalance} />
              {` USDC`}
            </p>
          </span>
        </div>

        <AnimatePresence mode="wait">
          {errorMessage && (
            <motion.small
              className="block leading-6 text-red-500 text-right"
              {...FadeInOutQuick}
            >
              {errorMessage}
            </motion.small>
          )}
        </AnimatePresence>

        <small className="flex flex-col pt-2 text-center leading-6 text-gray-600">
          {`Last updated: ${now}`}
        </small>
      </div>
    </div>
  );
};
