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
import { OptionChainModalActions } from "src/state/types";
import { determineStrikes } from "../utils/determineStrikes";

export const Pricing = ({
  amount,
  positionData,
  strategy,
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
    strikes,
  } = positionData;

  const isStrangle = strategy === OptionChainModalActions.LONG_STRANGLE;
  const strikesSelected = strikes && strikes[0] && strikes[1];

  const errorMessage = useMemo(() => {
    switch (true) {
      case amount && !strikesSelected && isStrangle:
        return "Please select your strikes.";

      case amount && !strikesSelected:
        return "Please select a strike.";

      case remainingBalance <= 0 && Boolean(quote):
        return "Final balance cannot be negative.";

      case utilisationHigh:
        return "DHV utilisation is high. Some TXs may fail.";

      default:
        return "";
    }
  }, [positionData]);

  const [callStrikes, putStrikes] = useMemo(() => {
    return determineStrikes(
      ethPrice,
      isStrangle,
      Object.entries(data[activeExpiry!])
    );
  }, [data]);

  const handleSelect =
    (index: number) => (event: ChangeEvent<HTMLSelectElement>) => {
      const selectedStrike = event.currentTarget.value;

      if (isStrangle) {
        setSelectedStrike((currentStrikes) => {
          if (index) {
            return [currentStrikes[0], selectedStrike];
          } else {
            return [selectedStrike, currentStrikes[1]];
          }
        });
      } else {
        setSelectedStrike([selectedStrike, selectedStrike]);
      }
    };

  return (
    <div className="flex flex-col">
      <div className="w-4/5 xl:w-3/5 mx-auto py-3">
        <span className="flex">
          <p className="mr-auto my-auto">
            {isStrangle ? `Put strike:` : `Strike:`}
          </p>
          <RyskTooltip
            content={`Use this to select the strike price for the ${strategy.toLowerCase()}.`}
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

        {isStrangle && (
          <span className="flex pb-2 border-gray-600 border-b">
            <p className="mr-auto my-auto">{`Call strike:`}</p>
            <RyskTooltip
              content={`Use this to select the strike price for the ${strategy.toLowerCase()}.`}
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
        )}

        <AnimatePresence>
          {strikesSelected && (
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
                  content="The price at which your position will break even if held to expiry. The first value is for the CALL and the second is for the PUT."
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

      <small className="flex flex-col pb-3 text-center leading-6 text-gray-600">{`Last updated: ${now}`}</small>
    </div>
  );
};
