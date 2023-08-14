import type { ChangeEvent } from "react";

import { useEffect } from "react";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

export const FullCollateral = () => {
  const {
    dispatch,
    state: { collateralPreferences, selectedOption },
  } = useGlobalContext();

  const fullCollateralRequired =
    (collateralPreferences.type === "USDC" &&
      selectedOption?.callOrPut === "put") ||
    (collateralPreferences.type === "WETH" &&
      selectedOption?.callOrPut === "call");

  useEffect(() => {
    if (!fullCollateralRequired && collateralPreferences.full === true) {
      dispatch({
        type: ActionType.SET_COLLATERAL_PREFERENCES,
        collateralPreferences: {
          ...collateralPreferences,
          full: false,
        },
      });
    }
  }, [fullCollateralRequired]);

  const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: ActionType.SET_COLLATERAL_PREFERENCES,
      collateralPreferences: {
        ...collateralPreferences,
        full: event.currentTarget.checked,
      },
    });
  };

  return (
    <label
      className={`w-fit flex items-center justify-start select-none ${
        fullCollateralRequired
          ? "cursor-pointer"
          : "cursor-not-allowed opacity-50"
      }`}
    >
      {"Fully collateralised"}
      <input
        className="w-4 h-4 cursor-pointer ml-2 accent-bone-dark hover:accent-bone-light disabled:cursor-not-allowed"
        disabled={!fullCollateralRequired}
        name="full-collateral"
        type="checkbox"
        checked={collateralPreferences.full}
        onChange={handleCheckboxChange}
      />
    </label>
  );
};
