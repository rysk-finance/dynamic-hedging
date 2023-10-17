import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useDebouncedCallback, useThrottledCallback } from "use-debounce";

import { Refresh } from "src/Icons";
import { useGlobalContext } from "src/state/GlobalContext";

import { ActionType } from "src/state/types";

const REFRESH_SECONDS = 60;

export const RefreshButton = () => {
  const {
    dispatch,
    state: {
      ethLastUpdateTimestamp,
      options: { refresh },
    },
  } = useGlobalContext();

  const [refreshDisabled, setRefreshDisabled] = useState(false);

  const enableRefresh = useDebouncedCallback(
    () => setRefreshDisabled(false),
    REFRESH_SECONDS * 1000,
    {
      leading: false,
    }
  );

  const handleRefreshClick = useThrottledCallback(
    () => {
      refresh();
      dispatch({
        type: ActionType.SET_ETH_PRICE_LAST_UPDATED,
        timestamp: dayjs().unix(),
      });
    },
    REFRESH_SECONDS * 1000,
    {
      trailing: false,
    }
  );

  useEffect(() => {
    setRefreshDisabled(true);
    enableRefresh();
  }, [ethLastUpdateTimestamp]);

  return (
    <button
      className="mr-auto py-1.5"
      disabled={refreshDisabled}
      onClick={handleRefreshClick}
    >
      <span
        className={`flex border-black border rounded-lg py-1 px-3 ease-in-out duration-200 ${
          refreshDisabled ? "opacity-40" : ""
        }`}
      >
        <small className="leading-6 mr-2">{`Update positions: `}</small>
        <Refresh />
      </span>
    </button>
  );
};
