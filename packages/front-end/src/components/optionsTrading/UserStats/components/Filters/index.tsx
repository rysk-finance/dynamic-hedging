import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { Preferences } from "../../enums";

export const Filters = () => {
  const {
    dispatch,
    state: {
      userStats: {
        activePositionsFilters: { hideExpired },
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

  return (
    <div className="flex justify-end select-none">
      <span
        className="flex items-center cursor-pointer py-3"
        onClick={handleHideExpiredClick}
      >
        <small className="leading-6">{`Hide expired positions: `}</small>
        <div className="relative w-8 h-4 ml-2 p-1 bg-bone-dark rounded-full shadow-[inset_0_0_10px_rgba(0,0,0,0.2)]">
          <div
            className={`absolute ${
              hideExpired
                ? "left-[0.25rem] bg-green-900"
                : "left-[1.25rem] bg-red-900"
            } h-2 w-2 rounded-full ease-in-out duration-200`}
          ></div>
        </div>
      </span>
    </div>
  );
};
