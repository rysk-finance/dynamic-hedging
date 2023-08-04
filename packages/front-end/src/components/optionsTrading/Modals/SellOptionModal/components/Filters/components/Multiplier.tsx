import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

export const Multiplier = () => {
  const {
    dispatch,
    state: { collateralPreferences },
  } = useGlobalContext();

  const [multiplier, setMultiplier] = useState(collateralPreferences.amount);
  const [debouncedMultiplier] = useDebounce(multiplier, 300);

  useEffect(() => {
    dispatch({
      type: ActionType.SET_COLLATERAL_PREFERENCES,
      collateralPreferences: {
        ...collateralPreferences,
        amount: debouncedMultiplier,
      },
    });
  }, [debouncedMultiplier]);

  const handleMultiplierChange = (operation: "add" | "sub") => () => {
    if (operation === "add") {
      const amount = Math.floor(multiplier * 10 * 1.1) / 10;
      setMultiplier(amount);
    }

    if (operation === "sub") {
      const amount = Math.ceil((multiplier * 10) / 1.1) / 10;
      setMultiplier(amount);
    }
  };

  return (
    <div className="flex h-11 bg-white border border-gray-600 w-fit rounded-full">
      <button
        className="py-2.5 px-4 w-11 border-r border-gray-600/40 rounded-l-full disabled:cursor-not-allowed disabled:bg-gray-600/30"
        disabled={multiplier <= 1.1 || collateralPreferences.full}
        onClick={handleMultiplierChange("sub")}
      >
        {`-`}
      </button>
      <span className="text-center py-2.5 px-2 w-16 number-input-hide-arrows">
        {`${multiplier}x`}
      </span>
      <button
        className="py-2.5 px-4 w-11 border-l border-gray-600/40 rounded-r-full disabled:cursor-not-allowed disabled:bg-gray-600/30 "
        disabled={collateralPreferences.full}
        onClick={handleMultiplierChange("add")}
      >
        {`+`}
      </button>
    </div>
  );
};
