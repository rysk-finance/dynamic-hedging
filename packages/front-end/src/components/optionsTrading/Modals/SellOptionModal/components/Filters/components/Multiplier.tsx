import type { ChangeEvent } from "react";

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

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const amount = event.currentTarget.value;
    const decimals = amount.split(".");
    const rounded =
      decimals.length > 1
        ? `${decimals[0]}.${decimals[1].slice(0, 1)}`
        : event.currentTarget.value;

    setMultiplier(parseFloat(rounded));
  };

  const handleInputBlur = () => {
    if (multiplier < 1.1) setMultiplier(1.1);
  };

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
        className="py-2.5 px-4 w-11 border-r border-gray-600/40 rounded-l-full disabled:cursor-not-allowed disabled:bg-gray-600/10"
        disabled={multiplier <= 1.1 || collateralPreferences.full}
        onClick={handleMultiplierChange("sub")}
      >
        {`-`}
      </button>
      <input
        className="text-center py-2.5 px-2 w-16 number-input-hide-arrows disabled:cursor-not-allowed"
        disabled={collateralPreferences.full}
        inputMode="numeric"
        onBlur={handleInputBlur}
        onChange={handleInputChange}
        step={0.1}
        type="number"
        value={multiplier}
      />
      <button
        className="py-2.5 px-4 w-11 border-l border-gray-600/40 rounded-r-full disabled:cursor-not-allowed disabled:bg-gray-600/10 "
        disabled={collateralPreferences.full}
        onClick={handleMultiplierChange("add")}
      >
        {`+`}
      </button>
    </div>
  );
};
