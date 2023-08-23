import { AnimatePresence, motion } from "framer-motion";
import { Fragment } from "react";

import FadeInOut from "src/animation/FadeInOut";
import LoadingOrError from "src/components/shared/LoadingOrError";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActiveExpiryAlerts } from "../ExpiryAlerts";
import { Body } from "./components/Body";
import { Head } from "./components/Head";

export const Chain = () => {
  const {
    state: {
      options: { activeExpiry, data, error },
      userTradingPreferences: { calendarMode },
    },
  } = useGlobalContext();

  const hasData = Object.values(data).length;

  return (
    <AnimatePresence mode="wait">
      {hasData ? (
        <motion.table
          className="block bg-bone overflow-x-auto overflow-y-hidden"
          key="chain"
          {...FadeInOut(0.75)}
        >
          {Object.entries(data).map(([expiry, strikeData]) => {
            if (!calendarMode && activeExpiry !== expiry) return null;

            return (
              <Fragment key={expiry}>
                <ActiveExpiryAlerts expiry={expiry} />
                <Head expiry={expiry} />
                <Body chainRows={Object.values(strikeData)} expiry={expiry} />
              </Fragment>
            );
          })}
        </motion.table>
      ) : (
        <LoadingOrError
          className="border-black border-t-2"
          error={error}
          extraStrings={[
            "Checking availability...",
            "Calculating exposure...",
            "Computing series...",
            "Fetching quotes...",
            "Determining greeks...",
            "Evaluating IV...",
          ]}
          key="loading"
          stringSpeed={500}
        />
      )}
    </AnimatePresence>
  );
};
