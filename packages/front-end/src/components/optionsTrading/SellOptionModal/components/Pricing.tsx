import type { RefObject } from "react";

import type { PricingProps } from "../types";

import { AnimatePresence, motion } from "framer-motion";
import CountUp from "react-countup";

import { easeOutCubic } from "src/animation/easing";
import FadeInOut from "src/animation/FadeInOut";
import LoadingOrError from "src/components/shared/LoadingOrError";

export const Pricing = ({ positionData }: PricingProps) => {
  const { created, inProfit, now, title, totalPaid, totalValue } = positionData;

  return (
    <AnimatePresence mode="wait">
      {title ? (
        <motion.span
          className="flex flex-col"
          key="price-data"
          {...FadeInOut(0.1)}
        >
          <p className="text-center py-4 bg-white border-b-2 border-black font-dm-mono">
            {title}
          </p>

          <span className="flex mx-auto py-4">
            <CountUp
              decimals={2}
              delay={0}
              duration={0.3}
              easingFn={easeOutCubic}
              end={totalPaid}
              prefix="Price paid: $ "
              preserveValue
              useEasing
            >
              {({ countUpRef }) => (
                <p
                  className="mr-2"
                  ref={countUpRef as RefObject<HTMLParagraphElement>}
                />
              )}
            </CountUp>
            <small className="leading-6 text-gray-600">{`Last updated: ${created}`}</small>
          </span>

          <span
            className={`flex mx-auto pb-4 ${
              inProfit ? "text-green-700" : "text-red-700"
            }`}
          >
            <CountUp
              decimals={2}
              delay={0}
              duration={0.3}
              easingFn={easeOutCubic}
              end={totalValue}
              prefix="Current value: $ "
              preserveValue
              useEasing
            >
              {({ countUpRef }) => (
                <p
                  className="mr-2"
                  ref={countUpRef as RefObject<HTMLParagraphElement>}
                />
              )}
            </CountUp>
            <small className="leading-6 text-gray-600">{`Last updated: ${now}`}</small>
          </span>
        </motion.span>
      ) : (
        <LoadingOrError
          key="loading-or-error"
          extraStrings={["Calculating prices...", "Fetching allowances..."]}
        />
      )}
    </AnimatePresence>
  );
};
