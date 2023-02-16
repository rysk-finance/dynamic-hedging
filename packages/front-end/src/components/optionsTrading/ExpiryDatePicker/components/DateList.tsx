import type { DateListProps, UserExpiryStatusNoTimestamp } from "../types";

import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";

import FadeInOutFixedDelay from "src/animation/FadeInOutFixedDelay";
import { DownChevron, UpChevron } from "src/Icons";

const getTitle = (hasBalance?: UserExpiryStatusNoTimestamp) => {
  switch (true) {
    case hasBalance?.isLong && hasBalance?.isShort:
      return "You have open positions for this expiry.";

    case hasBalance?.isLong:
      return "You have open long positions for this expiry.";

    case hasBalance?.isShort:
      return "You have open short positions for this expiry.";

    default:
      return "";
  }
};

export const DateList = ({
  expiryDates,
  visibleRange,
  expiryDate,
  handleExpirySelection,
  balances,
}: DateListProps) => (
  <ol className="grid grid-cols-4 col-span-10">
    <AnimatePresence initial={false} mode="popLayout">
      {expiryDates.map((timestamp, index) => {
        const datetime = dayjs.unix(timestamp);
        const [min, max] = visibleRange;
        const hasBalance = balances?.reduce(
          (acc, { isLong, isShort, timestamp }) => {
            if (timestamp === datetime.unix()) {
              acc.isLong = !acc.isLong ? isLong : acc.isLong;
              acc.isShort = !acc.isShort ? isShort : acc.isShort;
            }

            return acc;
          },
          {
            isLong: false,
            isShort: false,
          } as UserExpiryStatusNoTimestamp
        );

        if (index >= min && index <= max) {
          return (
            <motion.li
              key={timestamp}
              className={`text-center ease-in-out hover:bg-bone-dark ${
                timestamp === expiryDate ? "bg-bone-dark" : "bg-none"
              }`}
              onClick={handleExpirySelection(timestamp)}
              {...FadeInOutFixedDelay}
            >
              <button
                className="flex items-center justify-center w-full py-3"
                title={getTitle(hasBalance)}
              >
                <UpChevron
                  className={`min-w-6 h-6 stroke-green-500 ${
                    !hasBalance?.isLong && "opacity-0"
                  }`}
                  strokeWidth={4}
                />

                <time className="mx-4" dateTime={datetime.format("YYYY-MM-DD")}>
                  {`${datetime.format("MMM DD")}`}
                </time>

                <DownChevron
                  className={`min-w-6 h-6 stroke-red-500 ${
                    !hasBalance?.isShort && "opacity-0"
                  }`}
                  strokeWidth={4}
                />
              </button>
            </motion.li>
          );
        }

        return null;
      })}
    </AnimatePresence>
  </ol>
);
