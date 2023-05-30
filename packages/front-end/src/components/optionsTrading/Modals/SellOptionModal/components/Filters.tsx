import type { ChangeEvent } from "react";

import { AnimatePresence, motion } from "framer-motion";
import ReactSlider from "react-slider";
import { useDebouncedCallback } from "use-debounce";
import { useEffect } from "react";

import { USDC, WETH } from "src/Icons";
import FadeInOut from "src/animation/FadeInOut";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

export const Filters = () => {
  const {
    state: { collateralPreferences, selectedOption },
    dispatch,
  } = useGlobalContext();

  const fullCollateralRequired =
    (collateralPreferences.type === "USDC" &&
      selectedOption?.callOrPut === "put") ||
    (collateralPreferences.type === "WETH" &&
      selectedOption?.callOrPut === "call");

  const toggleIsUSDC = collateralPreferences.type === "USDC";

  const handleCollateralTypeChange = () => {
    const type = toggleIsUSDC ? "WETH" : "USDC";

    dispatch({
      type: ActionType.SET_COLLATERAL_PREFERENCES,
      collateralPreferences: { ...collateralPreferences, type },
    });
  };

  const handleSliderChange = useDebouncedCallback((value: number) => {
    dispatch({
      type: ActionType.SET_COLLATERAL_PREFERENCES,
      collateralPreferences: { ...collateralPreferences, amount: value },
    });
  }, 300);

  const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
    dispatch({
      type: ActionType.SET_COLLATERAL_PREFERENCES,
      collateralPreferences: {
        ...collateralPreferences,
        full: event.currentTarget.checked,
      },
    });
  };

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

  // Risk icon
  // Move collat/liquid figures above premium

  return (
    <div
      className="flex flex-col w-3/5 mx-auto pt-4 select-none"
      id="sell-collateral"
    >
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

      <div
        className="relative"
        title="Select the collateral multiplier you wish to use."
      >
        <ReactSlider
          ariaLabel="Adjust collateral"
          className="flex w-full h-12 cursor-pointer"
          disabled={collateralPreferences.full}
          defaultValue={collateralPreferences.amount}
          onChange={handleSliderChange}
          renderTrack={(props) => (
            <div
              {...props}
              className="inset-0 bg-black h-0.5 rounded-full translate-y-[1.5rem]"
            />
          )}
          max={5}
          min={1}
          step={0.1}
          renderThumb={(props) => {
            return (
              <div
                {...props}
                className={`w-6 h-6 rounded-full bg-bone border-2 border-black ease-in-out duration-200 translate-y-[0.8125rem]`}
              />
            );
          }}
        />

        <div className="absolute pointer-events-none flex justify-between w-full bottom-[-0.4rem]">
          {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((value) => (
            <small className="w-6 text-center" key={value}>{`${value}x`}</small>
          ))}
        </div>
      </div>

      <label
        className="flex items-center ml-auto select-none cursor-pointer my-2"
        title={"Use full collateral."}
      >
        <input
          className="w-4 h-4 cursor-pointer mr-2 accent-bone-dark hover:accent-bone-light"
          disabled={!fullCollateralRequired}
          name="full-collateral"
          type="checkbox"
          checked={collateralPreferences.full}
          onChange={handleCheckboxChange}
        />
        {"Use full collateral"}
      </label>

      <small className="flex leading-6 text-gray-600 border-gray-600 border-b">
        {`Using ${collateralPreferences.type} to supply ${
          collateralPreferences.full
            ? "full"
            : `${collateralPreferences.amount}x`
        } collateral.`}
      </small>
    </div>
  );
};
