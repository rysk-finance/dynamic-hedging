import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";

import FadeInOut from "src/animation/FadeInOut";
import { useMinuteUpdate } from "src/hooks/useMinuteUpdate";
import { useGlobalContext } from "src/state/GlobalContext";

dayjs.extend(duration);

export const ActiveExpiryAlerts = () => {
  const {
    state: {
      options: { activeExpiry, loading },
    },
  } = useGlobalContext();

  const [count] = useMinuteUpdate();

  const message = useMemo(() => {
    const datetime = dayjs.unix(Number(activeExpiry));
    const duration = dayjs.duration(datetime.diff(dayjs()));
    const days = duration.asDays();

    switch (true) {
      case days < 1:
        return "This expiry is now untradeable.";

      case days < 2:
        return `This expiry will become untradeable in ${duration.hours()}h ${duration.minutes()}m.`;

      default:
        break;
    }
  }, [activeExpiry, count, loading]);

  return (
    <AnimatePresence mode="wait">
      {message ? (
        <motion.span
          className="block text-center py-3 border-t-2 border-black"
          key={activeExpiry}
          {...FadeInOut()}
        >
          {message}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
};
