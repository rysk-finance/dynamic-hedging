import { AnimatePresence, motion } from "framer-motion";

import { USDC, WETH } from "src/Icons";
import FadeInOut from "src/animation/FadeInOut";
import { RyskTooltip } from "src/components/shared/RyskToolTip";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

export const CollateralTypeSlider = () => {
  const {
    state: {
      collateralPreferences,
      userTradingPreferences: { tutorialMode },
    },
    dispatch,
  } = useGlobalContext();

  const toggleIsUSDC = collateralPreferences.type === "USDC";

  const handleCollateralTypeChange = () => {
    const type = toggleIsUSDC ? "WETH" : "USDC";

    dispatch({
      type: ActionType.SET_COLLATERAL_PREFERENCES,
      collateralPreferences: { ...collateralPreferences, type },
    });
  };

  return (
    <RyskTooltip
      content="Click to change the asset you wish to use to collateralize your position."
      disabled={!tutorialMode}
      placement="top"
    >
      <div
        className="relative w-20 h-11 my-2 p-1 bg-bone-dark rounded-full shadow-[inset_0_0_10px_rgba(0,0,0,0.2)] cursor-pointer"
        onClick={handleCollateralTypeChange}
      >
        <div
          className={`absolute ${
            toggleIsUSDC ? "left-[0.25rem]" : "left-[2.5rem]"
          } h-9 w-9 rounded-full ease-in-out duration-200`}
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
    </RyskTooltip>
  );
};
