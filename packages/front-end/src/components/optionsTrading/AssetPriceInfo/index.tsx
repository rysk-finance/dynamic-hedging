import { AnimatePresence, motion } from "framer-motion";

import { Ether, Question, USDC } from "src/Icons";
import FadeInOut from "src/animation/FadeInOut";
import FadeInOutFixedDelay from "src/animation/FadeInOutFixedDelay";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { CurrentPrice } from "./components/CurrentPrice";
import { Error } from "./components/Error";
import { OneDayChange } from "./components/OneDayChange";
import { usePrice } from "./hooks/usePrice";

export const AssetPriceInfo = () => {
  const {
    state: {
      ethPrice,
      ethPriceUpdateTime,
      eth24hHigh,
      eth24hLow,
      eth24hChange,
      ethPriceError,
    },
    dispatch,
  } = useGlobalContext();

  const [update] = usePrice();

  const handleHelpClick = () => {
    dispatch({ type: ActionType.SET_TUTORIAL_INDEX, index: 0 });
  };

  const ready = Boolean(!ethPriceError && ethPrice && ethPriceUpdateTime);

  return (
    <motion.div className="flex" {...FadeInOut()}>
      <button
        className="w-full h-24 flex items-stretch"
        id="chain-price-info"
        onClick={update}
        title="Click to refetch price data."
      >
        <span className="relative flex min-w-[8rem] py-4 border-r-2 border-black">
          <div className="absolute left-4 z-10 flex items-center justify-center w-16 h-16 bg-[#ECEFF0]/90 rounded-full">
            <Ether aria-label="Ethereum logo" className="h-12" />
          </div>
          <USDC aria-label="USDC logo" className="absolute right-4 z-0 h-16" />
        </span>

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
