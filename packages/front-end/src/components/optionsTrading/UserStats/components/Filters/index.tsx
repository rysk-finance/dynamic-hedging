import { useGlobalContext } from "src/state/GlobalContext";
import {
  LocalStorageKeys,
  setLocalStorageObject,
} from "src/state/localStorage";
import { ActionType } from "src/state/types";
import { SimpleToggle } from "../../../../shared/SimpleToggle";

export const Filters = () => {
  const {
    dispatch,
    state: {
      userStats: {
        activePositionsFilters: { compact, hideExpired, returnFormat },
      },
    },
  } = useGlobalContext();

  const handleHideExpiredClick = () => {
    const activePositionsFilters = { hideExpired: !hideExpired };

    setLocalStorageObject(
      LocalStorageKeys.ACTIVE_POSITIONS_FILTERS_HIDE_EXPIRED,
      activePositionsFilters
    );

    dispatch({
      type: ActionType.SET_USER_STATS,
      activePositionsFilters,
    });
  };

  const handleCompactClick = () => {
    const activePositionsFilters = { compact: !compact };

    setLocalStorageObject(
      LocalStorageKeys.ACTIVE_POSITIONS_FILTERS_COMPACT,
      activePositionsFilters
    );

    dispatch({
      type: ActionType.SET_USER_STATS,
      activePositionsFilters,
    });
  };

  const handleReturnFormatClick = () => {
    const activePositionsFilters = { returnFormat: !returnFormat };

    setLocalStorageObject(
      LocalStorageKeys.ACTIVE_POSITIONS_RETURN_FORMAT,
      activePositionsFilters
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
        onClick={handleReturnFormatClick}
      >
        <SimpleToggle isActive={returnFormat}>{`P/L / ROI:`}</SimpleToggle>
      </span>

      <span
        className="flex items-center cursor-pointer mr-8 py-3"
        onClick={handleCompactClick}
      >
        <SimpleToggle isActive={compact}>{`Compact view:`}</SimpleToggle>
      </span>

      <span
        className="flex items-center cursor-pointer py-3"
        onClick={handleHideExpiredClick}
      >
        <SimpleToggle
          isActive={hideExpired}
        >{`Hide expired positions:`}</SimpleToggle>
      </span>
    </div>
  );
};
