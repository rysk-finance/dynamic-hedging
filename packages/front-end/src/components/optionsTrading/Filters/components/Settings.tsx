import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

import { Cog } from "src/Icons";

export const Settings = () => {
  const {
    dispatch,
    state: { calendarMode },
  } = useGlobalContext();

  const handleClick = () => {
    dispatch({
      type: ActionType.SET_CALENDAR_MODE,
      enabled: !calendarMode,
    });
  };

  return (
    <button
      className="p-3 border-l-2 border-black hover:bg-bone-light"
      id="filter-reset"
      onClick={handleClick}
    >
      <Cog />
    </button>
  );
};
