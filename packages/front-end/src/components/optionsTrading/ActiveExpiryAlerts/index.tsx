import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useGlobalContext } from "src/state/GlobalContext";
import FadeInOut from "src/animation/FadeInOut";

dayjs.extend(duration);

export const ActiveExpiryAlerts = () => {
  const {
    state: {
      options: { activeExpiry },
    },
  } = useGlobalContext();

  const datetime = dayjs.unix(Number(activeExpiry));
  const duration = dayjs.duration(datetime.diff(dayjs()));

  const getMessage = () => {
    switch (duration.days()) {
      case 0:
        return "This expiry is now untradeable.";

      case 1:
        return `This expiry will become untradeable in ${duration.hours()}h ${duration.minutes()}m.`;

      default:
        break;
    }
  };

  const message = useMemo(() => getMessage(), [activeExpiry]);

  return (
    <AnimatePresence mode="wait">
      {message ? (
        <motion.span
          className="block text-center py-3 border-t-2 border-black"
          key={message}
          {...FadeInOut()}
        >
          {message}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
};
