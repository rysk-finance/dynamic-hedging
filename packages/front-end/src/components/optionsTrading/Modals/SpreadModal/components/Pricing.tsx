import { ChangeEvent } from "react";

import { PricingProps } from "../types";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";

import { DownChevron } from "src/Icons";
import FadeInOutQuick from "src/animation/FadeInOutQuick";
import FadeInUpDelayed from "src/animation/FadeInUpDelayed";
import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { RyskTooltip } from "src/components/shared/RyskToolTip";
import { useGlobalContext } from "src/state/GlobalContext";
import { MAX_TRADE_SIZE, MIN_TRADE_SIZE } from "../../Shared/utils/constants";
import { getAvailableStrikes } from "../utils/determineStrikes";

export const Pricing = ({
  positionData,
  size,
  strategy,
  strikeState: { selectedStrike, setSelectedStrike },
}: PricingProps) => {
  const {
    state: {
      options: {
        activeExpiry,
        data,
        liquidityPool: { utilisationHigh },
      },
      userTradingPreferences: { tutorialMode },
    },
  } = useGlobalContext();

  const {
    breakEven,
    collateral,
    fee,
    hasRequiredCapital,
    isCredit,
    isPut,
    netPremium,
    now,
    remainingBalance,
    slippage,
    strikes,
  } = positionData;

  const strikesSelected = strikes[0] && strikes[1];
  const premium = isCredit ? netPremium : Math.abs(netPremium);

  const errorMessage = useMemo(() => {
    switch (true) {
      case size && !strikesSelected:
        return "Please select your strikes.";

      case size && Number(size) < MIN_TRADE_SIZE:
      case size && Number(size) > MAX_TRADE_SIZE:
        return "Trade size must be between 0.1 and 1000.";

      case Boolean(size && strikesSelected && premium <= 0):
        return `${
          isCredit ? "Net premium received" : "Net premium paid"
        } cannot be negative.`;

      case remainingBalance <= 0 && Boolean(premium):
        return "Final balance cannot be negative.";

      case !hasRequiredCapital && Boolean(premium):
        return "Insufficient balance to cover transaction.";

      case utilisationHigh:
        return "DHV utilisation is high. Some TXs may fail.";

      default:
        return "";
    }
  }, [positionData]);

  const [callStrikes, putStrikes] = useMemo(() => {
    return getAvailableStrikes(
      Object.entries(data[activeExpiry!]),
      strikes,
      strategy,
      isPut
    );
  }, [data, strikes]);

  const handleSelect =
    (index: number) => (event: ChangeEvent<HTMLSelectElement>) => {
      const selectedStrike = event.currentTarget.value;

      setSelectedStrike((currentStrikes) => {
        if (index) {
          return [currentStrikes[0], selectedStrike];
        } else {
          return [selectedStrike, currentStrikes[1]];
        }
      });
    };

  return (
    <div className="flex flex-col">
      <div className="w-4/5 xl:w-3/5 mx-auto py-2">
        <span className="flex">
          <p className="mr-auto my-auto">{`Short strike:`}</p>
          <RyskTooltip
            content={`Use this to select the short strike price for the ${strategy.toLowerCase()}.`}
            disabled={!tutorialMode}
            placement="left"
          >
            <div className="relative flex w-2/5">
              <DownChevron className="h-6 w-6 absolute top-2.5 pointer-events-none" />
              <select
                className="bg-transparent	text-right appearance-none w-full cursor-pointer py-2.5 font-dm-mono"
                value={selectedStrike[0]}
                onChange={handleSelect(0)}
              >
                <option disabled value="">{`Select strike`}</option>
                {callStrikes.map((strike) => (
                  <option key={strike} value={strike}>
                    {`$ ${strike}`}
                  </option>
                ))}
              </select>
            </div>
          </RyskTooltip>
        </span>

        <span className="flex pb-2 border-gray-600 border-b">
          <p className="mr-auto my-auto">{`Long strike:`}</p>
          <RyskTooltip
            content={`Use this to select the long strike price for the ${strategy.toLowerCase()}.`}
            disabled={!tutorialMode}
            placement="left"
          >
            <div className="relative flex w-2/5">
              <DownChevron className="h-6 w-6 absolute top-2.5 pointer-events-none" />
              <select
                className="bg-transparent	text-right appearance-none w-full cursor-pointer py-2.5 font-dm-mono"
                value={selectedStrike[1]}
                onChange={handleSelect(1)}
              >
                <option disabled value="">{`Select strike`}</option>
                {putStrikes.map((strike) => (
                  <option key={strike} value={strike}>
                    {`$ ${strike}`}
                  </option>
                ))}
              </select>
            </div>
          </RyskTooltip>
        </span>

        <AnimatePresence>
          {strikesSelected && (
            <motion.div layout="position" {...FadeInUpDelayed(0.05)}>
              <span className="flex pt-2">
                <p className="mr-auto">
                  {isCredit ? "Net premium received:" : "Net premium paid:"}
                </p>
                <RyskTooltip
                  content="The total amount of USDC you will receive from selling this position."
                  disabled={!tutorialMode}
                  placement="left"
                >
                  <p className="font-medium">
                    <RyskCountUp value={premium} />
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

              <span className="flex">
                <p className="mr-auto">{`Total fee:`}</p>
                <RyskTooltip
                  content="The total fee that Rysk collects per contract."
                  disabled={!tutorialMode}
                  placement="left"
                >
                  <p className="font-medium">
                    <RyskCountUp value={fee} />
                    {` USDC`}
                  </p>
                </RyskTooltip>
              </span>

              <span className="flex pb-2 border-gray-600 border-b">
                <p className="mr-auto">{`Break even:`}</p>
                <RyskTooltip
                  content="The price at which your position will break even if held to expiry."
                  disabled={!tutorialMode}
                  placement="left"
                >
                  <p className="font-medium">
                    <RyskCountUp value={breakEven} />
                    {` USDC`}
                  </p>
                </RyskTooltip>
              </span>

              {isCredit && (
                <>
                  <span className="flex pt-2">
                    <p className="mr-auto">{`Collateral required:`}</p>

                    <RyskTooltip
                      content="The total amount of collateral required to cover the position."
                      disabled={!tutorialMode}
                      placement="left"
                    >
                      <p className="font-medium">
                        <RyskCountUp value={collateral} />
                        {` USDC`}
                      </p>
                    </RyskTooltip>
                  </span>

                  <span className="flex pb-2 border-gray-600 border-b">
                    <p className="mr-auto">{`Liquidation Price:`}</p>
                    <p className="font-medium">{`Fully Collateralised`}</p>
                  </span>
                </>
              )}

              <span className="flex pt-2">
                <p className="mr-auto">{`Balance after:`}</p>
                <p className="font-medium">
                  <RyskCountUp value={remainingBalance} />
                  {` USDC`}
                </p>
              </span>
            </motion.div>
          )}
        </AnimatePresence>

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
      </div>

      <small className="flex flex-col pb-3 text-center leading-6 text-gray-600">{`Last updated: ${now}`}</small>
    </div>
  );
};
