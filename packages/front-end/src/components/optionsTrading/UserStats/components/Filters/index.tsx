import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { Preferences } from "../../enums";
import { Toggle } from "./components/Toggle";

export const Filters = () => {
  const {
    dispatch,
    state: {
      userStats: {
        activePositionsFilters: { compact, hideExpired },
      },
    },
  } = useGlobalContext();

  const handleHideExpiredClick = () => {
    const activePositionsFilters = { hideExpired: !hideExpired };

    localStorage.setItem(
      Preferences.ACTIVE_POSITIONS_FILTERS_HIDE_EXPIRED,
      JSON.stringify(activePositionsFilters)
    );

    dispatch({
      type: ActionType.SET_USER_STATS,
      activePositionsFilters,
    });
  };

  const handleCompactClick = () => {
    const activePositionsFilters = { compact: !compact };

    localStorage.setItem(
      Preferences.ACTIVE_POSITIONS_FILTERS_COMPACT,
      JSON.stringify(activePositionsFilters)
    );

    dispatch({
      type: ActionType.SET_USER_STATS,
      activePositionsFilters,
    });
  };

  return (
    <div className="flex justify-end select-none">
      <span
        className="flex items-center cursor-pointer mr-8 py-3"
        onClick={handleCompactClick}
      >
        <Toggle isLeft={compact}>{`Compact view:`}</Toggle>
      </span>

      <span
        className="flex items-center cursor-pointer py-3"
        onClick={handleHideExpiredClick}
      >
        <Toggle isLeft={hideExpired}>{`Hide expired positions:`}</Toggle>
      </span>
    </div>
  );
};
