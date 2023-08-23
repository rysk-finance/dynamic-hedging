import { ChangeEvent } from "react";

import { PricingProps } from "../types";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";

import { DownChevron, Link } from "src/Icons";
import FadeInOutQuick from "src/animation/FadeInOutQuick";
import FadeInUpDelayed from "src/animation/FadeInUpDelayed";
import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { RyskTooltip } from "src/components/shared/RyskToolTip";
import { STRATEGY_LINKS } from "src/config/links";
import { useGlobalContext } from "src/state/GlobalContext";
import { Symbol } from "../../Shared/components/Symbol";

export const Pricing = ({
  amount,
  positionData,
  strikeState: { selectedStrike, setSelectedStrike },
}: PricingProps) => {
  const {
    state: {
      ethPrice,
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
    fee,
    now,
    premium,
    quote,
    remainingBalance,
    slippage,
    strike,
  } = positionData;

  const errorMessage = useMemo(() => {
    switch (true) {
      case amount && !strike:
        return "Please select a strike.";

      case remainingBalance <= 0 && Boolean(quote):
        return "Final balance cannot be negative.";

      case utilisationHigh:
        return "DHV utilisation is high. Some TXs may fail.";

      default:
        return "";
    }
  }, [positionData]);

  const availableStrikes = useMemo(() => {
    const strikes = Object.keys(data[activeExpiry!]);
    const range = strikes.some((strike) => parseFloat(strike) % 100) ? 50 : 100;

    return strikes.filter((strike) => {
      const strikeInt = parseFloat(strike);
      const lowerBound = ethPrice - range;
      const upperBound = ethPrice + range;

      return strikeInt >= lowerBound && strikeInt <= upperBound;
    });
  }, [data]);

  const handleSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedStrike(event.currentTarget.value);
  };

  return (
    <div className="flex flex-col">
      <Symbol {...positionData}>
        <p className="flex text-center text-sm justify-center">
          {`Outlook: Neutral | Profit: Unlimited | Risk: Defined`}
        </p>

        <p className="flex text-center text-sm justify-center">
          <a
            className="flex !text-cyan-dark-compliant py-3"
            href={STRATEGY_LINKS.LONG_STRADDLE}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Link className="w-4 h-4 mr-2 my-0.5" />
            {`Learn more about long straddles.`}
          </a>
        </p>
      </Symbol>

      <div className="w-4/5 xl:w-3/5 mx-auto py-3">
        <span className="flex pb-2 border-gray-600 border-b">
          <p className="mr-auto">{`Strike:`}</p>
          <div className="relative flex w-1/3">
            <DownChevron className="h-6 w-6 absolute pointer-events-none" />
            <select
              className="bg-transparent	text-right appearance-none w-full cursor-pointer"
              value={selectedStrike}
              onChange={handleSelect}
            >
              <option disabled value="">{`Select strike`}</option>
              {availableStrikes.map((strike) => (
                <option key={strike} value={strike}>
                  {`$ ${strike}`}
                </option>
              ))}
            </select>
          </div>
        </span>

        <AnimatePresence>
          {strike && (
            <motion.div layout="position" {...FadeInUpDelayed(0.05)}>
              <span className="flex pt-2">
                <p className="mr-auto">{`Premium:`}</p>
                <RyskTooltip
                  content="The amount of USDC required per contract."
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
                <p className="mr-auto">{`Fee:`}</p>
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

              <small className="block leading-6 text-gray-600 border-gray-600 border-b">
                {`Premium and fees are per option.`}
              </small>

              <span className="flex pt-2">
                <p className="mr-auto">{`Break even:`}</p>
                <RyskTooltip
                  content="The price at which your position will break even if held to expiry."
                  disabled={!tutorialMode}
                  placement="left"
                >
                  <p className="font-medium">
                    <RyskCountUp value={breakEven[0]} />
                    {` USDC / `}
                    <RyskCountUp value={breakEven[1]} />
                    {` USDC`}
                  </p>
                </RyskTooltip>
              </span>

              <span className="flex pb-2 border-gray-600 border-b">
                <p className="mr-auto">{`Total to pay:`}</p>
                <RyskTooltip
                  content="The total amount of USDC required to open this position."
                  disabled={!tutorialMode}
                  placement="left"
                >
                  <p className="font-medium">
                    <RyskCountUp value={quote} />
                    {` USDC`}
                  </p>
                </RyskTooltip>
              </span>

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

      <small className="flex flex-col pb-4 text-center leading-6 text-gray-600">
        {`Last updated: ${now}`}
      </small>
    </div>
  );
};
