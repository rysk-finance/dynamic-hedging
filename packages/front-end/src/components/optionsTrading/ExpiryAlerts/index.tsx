import type { ExpiryAlertsProps } from "./types";

import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useGlobalContext } from "src/state/GlobalContext";
import FadeInOut from "src/animation/FadeInOut";

dayjs.extend(duration);

export const ActiveExpiryAlerts = ({ expiry }: ExpiryAlertsProps) => {
  const {
    state: {
      options: { loading },
    },
  } = useGlobalContext();

  const datetime = dayjs.unix(Number(expiry));
  const duration = dayjs.duration(datetime.diff(dayjs()));

  const getMessage = () => {
    const days = duration.asDays();

    switch (true) {
      case days < 1:
        return "This expiry is now untradeable.";

      case days < 2:
        return `This expiry will become untradeable in ${duration.hours()}h ${duration.minutes()}m.`;

      default:
        break;
    }
  };

  const message = useMemo(() => getMessage(), [loading]);

  return (
    <AnimatePresence mode="wait">
      {message ? (
        <motion.thead
          className="block text-center py-3 border-t-2 border-black"
          key={expiry}
          {...FadeInOut()}
        >
          <tr className="block">
            <th className="block text-center font-normal">{message}</th>
          </tr>
        </motion.thead>
      ) : null}
    </AnimatePresence>
  );
};
