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

  const [manualUpdateTimestamp, setManualUpdateTimestamp] = useState(
    dayjs().unix()
  );

  useEffect(() => {
    // Check Ether price every five seconds.
    const priceCheckInterval = setInterval(async () => {
      const newPrice = await priceFeedGetRate();

      if (newPrice !== ethPrice) {
        refresh();
      }
    }, 1000 * 5);

    return () => clearInterval(priceCheckInterval);
  }, [ethPrice, manualUpdateTimestamp, refresh]);

  // Rate limit manual updates to every 15 seconds.
  // Manual update also resets the cycle on the automatic updates.
  const handleManualUpdate = () => {
    const now = dayjs().unix();

    if (now >= manualUpdateTimestamp + 15) {
      refresh();
      setManualUpdateTimestamp(dayjs().unix());
    }
  };

  return [handleManualUpdate] as const;
};
