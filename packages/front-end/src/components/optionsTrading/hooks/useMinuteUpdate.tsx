import dayjs from "dayjs";
import { useEffect } from "react";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

/**
 * This hook causes a state update at the top of every minute to allow
 * options chain timers and actions to be updated automatically during
 * periods of low vol.
 *
 * @returns void
 */
export const useMinuteUpdate = () => {
  const {
    dispatch,
    state: {
      ethLastUpdateTimestamp,
      options: { refresh },
    },
  } = useGlobalContext();

  useEffect(() => {
    const interval = setInterval(() => {
      if (dayjs().second() === 59) {
        dispatch({
          type: ActionType.SET_ETH_PRICE_LAST_UPDATED,
          timestamp: dayjs().unix(),
        });
        refresh();
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [ethLastUpdateTimestamp]);
};
