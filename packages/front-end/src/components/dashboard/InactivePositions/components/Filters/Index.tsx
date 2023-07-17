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
        inactivePositionsFilters: { compact },
      },
    },
  } = useGlobalContext();

  const handleCompactClick = () => {
    const inactivePositionsFilters = { compact: !compact };

    setLocalStorageObject(
      LocalStorageKeys.INACTIVE_POSITIONS_FILTERS_COMPACT,
      inactivePositionsFilters
    );

    dispatch({
      type: ActionType.SET_USER_STATS,
      inactivePositionsFilters,
    });
  };

  return (
    <div className="flex justify-end select-none">
      <span
        className="flex items-center cursor-pointer py-3"
        onClick={handleCompactClick}
      >
        <SimpleToggle isActive={compact}>{`Compact view:`}</SimpleToggle>
      </span>
    </div>
  );
};
