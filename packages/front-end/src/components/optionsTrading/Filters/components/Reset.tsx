import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

export const Reset = () => {
  const { dispatch } = useGlobalContext();

  const handleClick = () => {
    dispatch({
      type: ActionType.SET_VISIBLE_COLUMNS,
    });
  };

  return (
    <button
      className="ml-auto px-7 py-3 font-medium border-black border-l-2 hover:bg-bone-light"
      onClick={handleClick}
    >
      {`Reset`}
    </button>
  );
};
