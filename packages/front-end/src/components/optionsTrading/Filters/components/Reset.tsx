import { useOptionsTradingContext } from "src/state/OptionsTradingContext";
import { OptionsTradingActionType } from "src/state/types";

export const Reset = () => {
  const { dispatch } = useOptionsTradingContext();

  const handleClick = () => {
    dispatch({
      type: OptionsTradingActionType.RESET_VISIBLE_STRIKE_RANGE,
    });

    dispatch({
      type: OptionsTradingActionType.RESET_VISIBLE_COLUMNS,
    });
  };

  return (
    <button
      className="px-7 py-3 font-medium border-t-2 border-black xl:border-none hover:bg-bone-light"
      onClick={handleClick}
    >
      {`Reset`}
    </button>
  );
};
