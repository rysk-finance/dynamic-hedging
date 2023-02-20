import dayjs from "dayjs";
import { useState, useEffect } from "react";

import { useUpdateEthPrice } from "src/hooks/useUpdateEthPrice";

/**
 * Automated getter for Eth prices. Also exports a function for manual invocation.
 *
 * @returns [handleManualUpdate] - VoidFunction to call manual price fetch.
 */
export const usePrice = () => {
  const { updatePrice } = useUpdateEthPrice();

  const [manualUpdateTimestamp, setManualUpdateTimestamp] = useState(
    dayjs().unix()
  );

  useEffect(() => {
    updatePrice();
  }, [updatePrice]);

  useEffect(() => {
    // Refreshing the price every 120 seconds to force a recalculation of premiums.
    // 120 seconds is also the coin gecko 429 wait time.
    const priceCheckInternal = setInterval(() => {
      updatePrice();
    }, 1000 * 60 * 2);

    return () => clearInterval(priceCheckInternal);
  }, [manualUpdateTimestamp]);

  // Rate limit manual updates to every 30 seconds.
  // Manual update also resets the cycle on the automatic updates.
  const handleManualUpdate = () => {
    const now = dayjs().unix();

    if (now >= manualUpdateTimestamp + 30) {
      updatePrice();
      setManualUpdateTimestamp(dayjs().unix());
    }
  };

  return [handleManualUpdate] as const;
};
