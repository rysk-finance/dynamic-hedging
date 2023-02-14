import type { DateListProps } from "../types";

import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";

import FadeInOutFixedDelay from "src/animation/FadeInOutFixedDelay";

export const DateList = ({
  expiryDates,
  visibleRange,
  expiryDate,
  handleExpirySelection,
}: DateListProps) => (
  <ol className="grid grid-cols-4 col-span-10">
    <AnimatePresence initial={false} mode="popLayout">
      {expiryDates.map((timestamp, index) => {
        const datetime = dayjs.unix(timestamp);
        const [min, max] = visibleRange;

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
              <button className="relative w-full py-3">
                <time dateTime={datetime.format("YYYY-MM-DD")}>
                  {`${datetime.format("MMM DD")}`}
                </time>
              </button>
            </motion.li>
          );
        }

        return null;
      })}
    </AnimatePresence>
  </ol>
);
