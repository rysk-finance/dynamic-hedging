import dayjs from "dayjs";
import { useState, useEffect } from "react";

import { useGlobalContext } from "src/state/GlobalContext";
import { priceFeedGetRate } from "src/hooks/useUpdateEthPrice";

/**
 * Automated getter for Eth prices. Also exports a function for manual invocation.
 *
 * @returns [handleManualUpdate] - VoidFunction to call manual price fetch.
 */
export const usePrice = () => {
  const {
    state: {
      options: { refresh },
      ethPrice,
    },
  } = useGlobalContext();

  const [intervalTime, setIntervalTime] = useState(5);
  const [manualUpdateTimestamp, setManualUpdateTimestamp] = useState(
    dayjs().unix()
  );

  useEffect(() => {
    // Check Ether price in increasing intervals, starting at five seconds.
    const priceCheckInterval = setInterval(async () => {
      const newPrice = await priceFeedGetRate();

      if (newPrice !== ethPrice) {
        refresh();
        setIntervalTime(5);
      } else {
        setIntervalTime((currentTime) => ++currentTime);
      }
    }, 1000 * intervalTime);

    return () => clearInterval(priceCheckInterval);
  }, [ethPrice, intervalTime, manualUpdateTimestamp, refresh]);

  // Rate limit manual updates to every 30 seconds.
  // Manual update also resets the cycle on the automatic updates.
  const handleManualUpdate = () => {
    const now = dayjs().unix();

    if (now >= manualUpdateTimestamp + 30) {
      refresh();
      setManualUpdateTimestamp(dayjs().unix());
    }
  };

  return [handleManualUpdate] as const;
};
