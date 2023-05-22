import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback } from "react";

import { Question } from "src/Icons";
import FadeInOut from "src/animation/FadeInOut";
import FadeInOutFixedDelay from "src/animation/FadeInOutFixedDelay";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { AssetLogos } from "./components/AssetLogos";
import { CurrentPrice } from "./components/CurrentPrice";
import { Error } from "./components/Error";
import { OneDayChange } from "./components/OneDayChange";

const MANUAL_LIMIT_SECONDS = 30;

export const AssetPriceInfo = () => {
  const {
    state: {
      ethPrice,
      ethPriceUpdateTime,
      eth24hHigh,
      eth24hLow,
      eth24hChange,
      ethPriceError,
      ethLastUpdateTimestamp,
      options: { refresh },
    },
    dispatch,
  } = useGlobalContext();

  const handleManualUpdate = useCallback(() => {
    const now = dayjs().unix();

    if (now >= ethLastUpdateTimestamp + MANUAL_LIMIT_SECONDS) {
      refresh();
      dispatch({
        type: ActionType.SET_ETH_PRICE_LAST_UPDATED,
        timestamp: dayjs().unix(),
      });
    }
  }, [ethLastUpdateTimestamp]);

  const handleHelpClick = () => {
    dispatch({ type: ActionType.SET_CHAIN_TUTORIAL_INDEX, index: 0 });
  };

  const ready = Boolean(!ethPriceError && ethPrice && ethPriceUpdateTime);

  return (
    <motion.div className="flex" {...FadeInOut()}>
      <button
        className="w-full h-24 flex items-stretch"
        id="chain-price-info"
        onClick={handleManualUpdate}
        title="Click to refetch price data."
      >
        <AssetLogos />

        <AnimatePresence mode="wait">
          {ready && (
            <motion.div
              className="flex w-full bg-[url('./assets/white-ascii-50.png')] bg-cover bg-center"
              {...FadeInOutFixedDelay}
            >
              <CurrentPrice
                price={ethPrice}
                latestUpdate={ethPriceUpdateTime}
              />

              <OneDayChange
                high={eth24hHigh}
                low={eth24hLow}
                change={eth24hChange}
              />
            </motion.div>
          )}

          {ethPriceError && <Error />}
        </AnimatePresence>
      </button>

      <button
        className="ml-auto border-l-2 border-black"
        onClick={handleHelpClick}
        title="Click to go through our introduction to the Rysk options chain."
      >
        <Question className="min-w-[8rem] w-24 h-24 py-4" />
      </button>
    </motion.div>
  );
};
