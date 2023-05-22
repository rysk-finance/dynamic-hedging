import dayjs from "dayjs";
import { useEffect, useState } from "react";

import { priceFeedGetRate } from "src/hooks/useUpdateEthPrice";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

const INITIAL_INTERVAL_SECONDS = 5;

/**
 * Automated getter for Eth prices.
 *
 * @returns void
 */
export const useLatestEthPrice = () => {
  const {
    dispatch,
    state: {
      options: { refresh },
      ethPrice,
      ethLastUpdateTimestamp,
    },
  } = useGlobalContext();

  const [intervalTime, setIntervalTime] = useState(INITIAL_INTERVAL_SECONDS);

  useEffect(() => {
    setIntervalTime(INITIAL_INTERVAL_SECONDS);
  }, [ethLastUpdateTimestamp]);

  useEffect(() => {
    // Check Ether price in increasing intervals, starting at five seconds.
    const priceCheckInterval = setInterval(async () => {
      const newPrice = await priceFeedGetRate();

      if (newPrice !== ethPrice) {
        refresh();
        setIntervalTime(INITIAL_INTERVAL_SECONDS);
        dispatch({
          type: ActionType.SET_ETH_PRICE_LAST_UPDATED,
          timestamp: dayjs().unix(),
        });
      } else {
        setIntervalTime((currentTime) => ++currentTime);
      }
    }, 1000 * intervalTime);

    return () => clearInterval(priceCheckInterval);
  }, [ethPrice, intervalTime, ethLastUpdateTimestamp, refresh]);
};
