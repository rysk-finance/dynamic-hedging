import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { SimpleToggle } from "../../../../shared/SimpleToggle";
import { Preferences } from "../../enums";

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

    localStorage.setItem(
      Preferences.INACTIVE_POSITIONS_FILTERS_COMPACT,
      JSON.stringify(inactivePositionsFilters)
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
