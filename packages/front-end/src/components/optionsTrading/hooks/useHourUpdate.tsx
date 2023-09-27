import dayjs from "dayjs";
import { useEffect } from "react";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

/**
 * This hook causes a state update at the top of every hour to allow
 * actions to be updated automatically during periods of low vol.
 *
 * @returns void
 */
export const useHourUpdate = () => {
  const {
    dispatch,
    state: {
      ethLastUpdateTimestamp,
      options: { refresh },
    },
  } = useGlobalContext();

  useEffect(() => {
    const interval = setInterval(() => {
      if (dayjs().second() === 59 && dayjs().minute() === 59) {
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
