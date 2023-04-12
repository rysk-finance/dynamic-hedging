import type { ChangeEvent } from "react";

import type { CollateralPreferences } from "src/state/types";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

import { USDC, WETH } from "src/Icons";
import FadeInOut from "src/animation/FadeInOut";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType, CollateralAmount } from "src/state/types";

export const Filters = () => {
  const {
    state: { collateralPreferences, selectedOption },
    dispatch,
  } = useGlobalContext();

  const fullCollateralNotRequired =
    (collateralPreferences.type === "USDC" &&
      selectedOption?.callOrPut === "call") ||
    (collateralPreferences.type === "WETH" &&
      selectedOption?.callOrPut === "put");

  const collateralCheckboxes = [
    {
      checked: collateralPreferences.amount === CollateralAmount["1.5x"],
      disabled: false,
      label: CollateralAmount["1.5x"],
      name: CollateralAmount["1.5x"],
      title: `Use ${CollateralAmount["1.5x"]} required Collateral.`,
    },
    {
      checked: collateralPreferences.amount === CollateralAmount["2x"],
      disabled: false,
      label: CollateralAmount["2x"],
      name: CollateralAmount["2x"],
      title: `Use ${CollateralAmount["2x"]} required Collateral.`,
    },
    {
      checked: collateralPreferences.amount === CollateralAmount["3x"],
      disabled: false,
      label: CollateralAmount["3x"],
      name: CollateralAmount["3x"],
      title: `Use ${CollateralAmount["3x"]} required Collateral.`,
    },
    {
      checked: collateralPreferences.amount === CollateralAmount["full"],
      disabled: fullCollateralNotRequired,
      label: "Full",
      name: CollateralAmount["full"],
      title: fullCollateralNotRequired
        ? "Full collateralization is not required for this position."
        : `Use ${CollateralAmount["full"]} collateralization.`,
    },
  ];

  const toggleIsUSDC = collateralPreferences.type === "USDC";

  const handleCollateralTypeChange = () => {
    const type = toggleIsUSDC ? "WETH" : "USDC";

    dispatch({
      type: ActionType.SET_COLLATERAL_PREFERENCES,
      collateralPreferences: { ...collateralPreferences, type },
    });
  };

  const handleCollateralAmountChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const amount = event.currentTarget.name as CollateralPreferences["amount"];

    dispatch({
      type: ActionType.SET_COLLATERAL_PREFERENCES,
      collateralPreferences: { ...collateralPreferences, amount },
    });
  };

  useEffect(() => {
    if (
      fullCollateralNotRequired &&
      collateralPreferences.amount === CollateralAmount["full"]
    ) {
      dispatch({
        type: ActionType.SET_COLLATERAL_PREFERENCES,
        collateralPreferences: {
          ...collateralPreferences,
          amount: CollateralAmount["2x"],
        },
      });
    }
  }, [fullCollateralNotRequired]);

  return (
    <div className="flex flex-col w-3/5 mx-auto pt-4 select-none" id="sell-collateral">
      <p className="leading-6 border-gray-600 border-b">{`Collateral Preferences`}</p>

      <div
        className="flex items-center justify-center my-2 cursor-pointer"
        onClick={handleCollateralTypeChange}
        title="Click to change the asset you wish to use to collateralize your position."
      >
        <span
          className={`font-medium ease-in-out duration-200 ${
            toggleIsUSDC ? "" : "text-gray-600"
          }`}
        >
          {`USDC`}
        </span>

        <div className="relative w-24 h-12 mx-4 p-1 bg-bone-dark rounded-full shadow-[inset_0_0_10px_rgba(0,0,0,0.2)]">
          <div
            className={`absolute ${
              toggleIsUSDC ? "left-[0.25rem]" : "left-[3.25rem]"
            } h-10 w-10 rounded-full ease-in-out duration-200`}
          >
            <AnimatePresence mode="popLayout">
              {toggleIsUSDC ? (
                <motion.div key="USDC" {...FadeInOut()}>
                  <USDC aria-label="USDC icon" className="h-full w-full" />
                </motion.div>
              ) : (
                <motion.div key="Ether" {...FadeInOut()}>
                  <WETH aria-label="WETH icon" className="h-full w-full" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <span
          className={`font-medium ease-in-out duration-200 ${
            toggleIsUSDC ? "text-gray-600" : ""
          }`}
        >
          {`WETH`}
        </span>
      </div>

      <div className="flex items-center justify-between [&>*]:py-2 [&_*]:ease-in-out [&_*]:duration-100 [&_label]:whitespace-nowrap">
        {collateralCheckboxes.map((checkbox) => (
          <label
            className="flex items-center select-none cursor-pointer"
            key={checkbox.name}
            title={checkbox.title}
          >
            {checkbox.label}
            <input
              checked={checkbox.checked}
              className="w-4 h-4 cursor-pointer ml-2 accent-bone-dark hover:accent-bone-light"
              disabled={checkbox.disabled}
              name={checkbox.name}
              onChange={handleCollateralAmountChange}
              type="checkbox"
            />
          </label>
        ))}
      </div>

      <small className="block leading-6 text-gray-600 border-gray-600 border-b">
        {`Using ${collateralPreferences.type} to supply ${collateralPreferences.amount} collateral.`}
      </small>
    </div>
  );
};
