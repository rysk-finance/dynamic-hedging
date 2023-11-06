import type { OptionChainModal } from "src/state/types";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";

import { Close } from "src/Icons";
import FadeInOut from "src/animation/FadeInOut";
import FadeInUpDelayed from "src/animation/FadeInUpDelayed";
import { RyskModal } from "src/components/shared/RyskModal";
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

  const [modalVisible, setModalVisible] = useState(false);

  const hasRequiredState = useMemo(
    () => Boolean(activeExpiry && data[activeExpiry]),
    [activeExpiry, data]
  );

  const handleStrategyClick =
    (modal: OptionChainModal, selling: boolean) => () => {
      if (modalVisible) setModalVisible(false);

      dispatch({
        type: ActionType.SET_SELECTED_STRATEGY,
        buyOrSell: selling ? "sell" : "buy",
        strategy: modal,
      });
    };

  const handleModalClick = () => setModalVisible((current) => !current);

  if (!hasRequiredState && !loading)
    return (
      <div className="p-4 text-center font-medium">
        {`Apologies, but there was an issue loading Rysk strategies. Please refresh and try again.`}
      </div>
    );

  return (
    <>
      <div className="grid grid-cols-12">
        <RyskTooltip
          content="These strategies allow you to make one click transactions with multiple legs. To learn more, click on one."
          disabled={!tutorialMode}
        >
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 col-span-9 lg:col-span-10 h-14 overflow-hidden">
            <AnimatePresence>
              {hasRequiredState &&
                strategyList.map(
                  ({ active, description, Icon, label, modal, selling }) => {
                    if (!active) return null;

                    return (
                      <motion.button
                        className="flex justify-center py-1 mx-4 group/strategy-icon"
                        key={label}
                        onClick={handleStrategyClick(modal, selling)}
                        {...FadeInOut()}
                      >
                        <Icon className="h-6 mr-1 my-auto" />
                        <span className="w-40">
                          <p className="font-dm-mono text-sm font-medium">
                            {label}
                          </p>
                          <small className="block text-2xs !leading-1">
                            {description}
                          </small>
                        </span>
                      </motion.button>
                    );
                  }
                )}
            </AnimatePresence>
          </div>
        </RyskTooltip>

        <button
          className="grid col-span-3 lg:col-span-2 items-center border-black border-l-2 font-dm-mono p-2"
          onClick={handleModalClick}
        >
          <p className="text-sm">{`All strategies`}</p>
        </button>
      </div>

      <AnimatePresence>
        {hasRequiredState && modalVisible && (
          <RyskModal lightBoxClickFn={handleModalClick}>
            <span className="sticky top-0 z-50 grid grid-cols-10 bg-black text-white bg-[url('./assets/circle-lines.png')] bg-no-repeat bg-contain">
              <h2 className="col-span-4 col-start-4 text-lg font-medium text-center py-3">
                {`Select a strategy`}
              </h2>

              <button
                className={`col-span-1 col-start-10 mx-auto p-1.5`}
                onClick={handleModalClick}
                title="Click to close the modal."
              >
                <Close className="text-white h-8 w-8" />
              </button>
            </span>

            <div className="grid grid-cols-3 gap-4 py-3 px-8 overflow-hidden">
              {strategyList.map(
                (
                  { active, description, Icon, label, modal, outlook, selling },
                  index
                ) => {
                  if (!active) return null;

                  return (
                    <motion.button
                      className="flex flex-col items-center rounded-lg overflow-hidden border border-black group/strategy-icon"
                      key={label}
                      onClick={handleStrategyClick(modal, selling)}
                      {...FadeInUpDelayed(index * 0.1 + 0.3)}
                    >
                      <p className="w-full py-1 font-dm-mono text-sm font-medium text-white bg-black">
                        {label}
                      </p>
                      <p className="w-full py-1 font-dm-mono text-sm font-medium bg-white border-b border-black">
                        {outlook}
                      </p>
                      <Icon className="h-12 m-3" />
                      <p className="text-xs p-1 border-t border-black">
                        {description}
                      </p>
                    </motion.button>
                  );
                }
              )}
            </div>
          </RyskModal>
        )}
      </AnimatePresence>
    </>
  );
};
