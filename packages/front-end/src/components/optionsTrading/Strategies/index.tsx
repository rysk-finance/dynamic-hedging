import type { OptionChainModal } from "src/state/types";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";

import FadeInOut from "src/animation/FadeInOut";
import { RyskTooltip } from "src/components/shared/RyskToolTip";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { strategyList } from "./strategyList";

export const Strategies = () => {
  const {
    dispatch,
    state: {
      options: { activeExpiry, data, loading },
      userTradingPreferences: { tutorialMode },
    },
  } = useGlobalContext();

  const hasRequiredState = useMemo(
    () => Boolean(activeExpiry && data[activeExpiry]),
    [activeExpiry, data]
  );

  const handleClick = (modal: OptionChainModal) => () => {
    if (hasRequiredState) {
      dispatch({
        type: ActionType.SET_OPTION_CHAIN_MODAL_VISIBLE,
        visible: modal,
      });
    }
  };

  if (!hasRequiredState && !loading)
    return (
      <div className="p-4 text-center font-medium">
        {`Apologies, but there was an issue loading Rysk strategies. Please refresh and try again.`}
      </div>
    );

  return (
    <div className="grid grid-cols-12">
      <RyskTooltip
        content="These strategies allow you to make one click transactions with multiple legs. To learn more, click on one."
        disabled={!tutorialMode}
      >
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 col-span-9 lg:col-span-10 h-14 overflow-hidden">
          <AnimatePresence>
            {!loading &&
              strategyList.map(({ description, Icon, label, modal }) => (
                <motion.button
                  className="flex justify-center py-1 group/strategy-icon"
                  key={label}
                  onClick={handleClick(modal)}
                  {...FadeInOut()}
                >
                  <Icon className="h-12 mr-1" />
                  <span className="w-32">
                    <p className="font-dm-mono text-sm font-medium">{label}</p>
                    <small className="block text-2xs !leading-1">
                      {description}
                    </small>
                  </span>
                </motion.button>
              ))}
          </AnimatePresence>
        </div>
      </RyskTooltip>

      <button
        className="grid col-span-3 lg:col-span-2 items-center border-black border-l-2 font-dm-mono p-2"
        disabled
      >
        <p className="text-sm">{`More Strategies Coming Soon...`}</p>
      </button>
    </div>
  );
};
