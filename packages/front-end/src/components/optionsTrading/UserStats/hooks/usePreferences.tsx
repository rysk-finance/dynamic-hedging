import type { UserStats } from "src/state/types";

import { useEffect } from "react";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { Preferences } from "../enums";

export const usePreferences = () => {
  const { dispatch } = useGlobalContext();

  const activePositionsFiltersSorting = JSON.parse(
    localStorage.getItem(Preferences.ACTIVE_POSITIONS_FILTERS_SORTING) || "{}"
  ) as UserStats["activePositionsFilters"];

  const activePositionsFiltersHideExpired = JSON.parse(
    localStorage.getItem(Preferences.ACTIVE_POSITIONS_FILTERS_HIDE_EXPIRED) ||
      "{}"
  ) as UserStats["activePositionsFilters"];

  useEffect(() => {
    dispatch({
      type: ActionType.SET_USER_STATS,
      activePositionsFilters: {
        hideExpired: activePositionsFiltersHideExpired.hideExpired,
        isAscending: activePositionsFiltersSorting.isAscending,
        sort: activePositionsFiltersSorting.sort,
      },
    });
  }, []);
};
