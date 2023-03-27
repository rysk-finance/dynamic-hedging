import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

export const Reset = () => {
  const { dispatch } = useGlobalContext();

  const handleClick = () => {
    dispatch({
      type: ActionType.SET_VISIBLE_STRIKE_RANGE,
    });

    dispatch({
      type: ActionType.SET_VISIBLE_COLUMNS,
    });
  };

  return (
    <button
      className="px-7 py-3 font-medium border-t-2 border-black xl:border-none hover:bg-bone-light"
      id="filter-reset"
      onClick={handleClick}
    >
      {`Reset`}
    </button>
  );
};
