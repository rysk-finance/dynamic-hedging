import type { UserPositions } from "src/state/types";
import type { DateListProps } from "../types";

import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { AnimatePresence, motion } from "framer-motion";

import FadeInOutFixedDelay from "src/animation/FadeInOutFixedDelay";
import { DownChevron, UpChevron } from "src/Icons";
import { useGlobalContext } from "src/state/GlobalContext";

dayjs.extend(duration);

const getTitle = (positions?: UserPositions["expiry"]) => {
  switch (true) {
    case positions?.isLong && positions?.isShort:
      return "You have open positions for this expiry.";

    case positions?.isLong:
      return "You have open long positions for this expiry.";

    case positions?.isShort:
      return "You have open short positions for this expiry.";

    default:
      return "";
  }
};

export const DateList = ({
  visibleRange,
  handleExpirySelection,
}: DateListProps) => {
  const {
    state: {
      options: { activeExpiry, expiries, userPositions },
    },
  } = useGlobalContext();

  return (
    <ol className="grid grid-cols-6 col-span-10">
      <AnimatePresence initial={false} mode="popLayout">
        {expiries.map((timestamp, index) => {
          const datetime = dayjs.unix(Number(timestamp));
          const duration = dayjs.duration(datetime.diff(dayjs()));

          const [min, max] = visibleRange;
          const positions = userPositions[timestamp];

          if (index >= min && index <= max) {
            return (
              <motion.li
                key={timestamp}
                className={`text-center ease-in-out duration-100 hover:bg-bone-dark ${
                  timestamp === activeExpiry ? "bg-bone-dark" : "bg-none"
                }`}
                onClick={handleExpirySelection(timestamp)}
                {...FadeInOutFixedDelay}
              >
                <button
                  className="flex flex-col items-center justify-center w-full h-14"
                  title={getTitle(positions)}
                >
                  <div className="flex">
                    <DownChevron
                      className={`min-w-6 h-6 stroke-red-500 ${
                        !positions?.isShort && "opacity-0"
                      }`}
                      strokeWidth={4}
                    />

                    <time
                      className="mx-2 text-sm xl:text-base"
                      dateTime={datetime.format("YYYY-MM-DD")}
                    >
                      {`${datetime.format("DD MMM YY")}`}
                    </time>

                    <UpChevron
                      className={`min-w-6 h-6 stroke-green-500 ${
                        !positions?.isLong && "opacity-0"
                      }`}
                      strokeWidth={4}
                    />
                  </div>

                  <small className={`text-xs mt-1 `}>
                    {duration.asDays() < 1
                      ? `Untradeable`
                      : `${Math.floor(
                          duration.asDays()
                        )}d ${duration.hours()}h ${duration.minutes()}m`}
                  </small>
                </button>
              </motion.li>
            );
          }

          return null;
        })}
      </AnimatePresence>
    </ol>
  );
};
