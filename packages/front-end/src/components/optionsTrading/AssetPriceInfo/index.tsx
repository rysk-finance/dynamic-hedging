import { AnimatePresence, motion } from "framer-motion";

import FadeInOut from "src/animation/FadeInOut";
import FadeInOutFixedDelay from "src/animation/FadeInOutFixedDelay";
import { Question } from "src/Icons";
import { useGlobalContext } from "src/state/GlobalContext";
import { useOptionsTradingContext } from "src/state/OptionsTradingContext";
import { OptionsTradingActionType } from "src/state/types";
import { CurrentPrice } from "./components/CurrentPrice";
import { Error } from "./components/Error";
import { OneDayChange } from "./components/OneDayChange";
import { usePrice } from "./hooks/usePrice";

export const AssetPriceInfo = () => {
  const { dispatch } = useOptionsTradingContext();

  const {
    state: {
      ethPrice,
      ethPriceUpdateTime,
      eth24hHigh,
      eth24hLow,
      eth24hChange,
      ethPriceError,
    },
  } = useGlobalContext();

  const [update] = usePrice();

  const handleHelpClick = () => {
    dispatch({ type: OptionsTradingActionType.SET_TUTORIAL_INDEX, index: 0 });
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
        <img
          src="/icons/ethereum.svg"
          alt="Ethereum logo"
          className="min-w-[6rem] h-24 py-4 border-r-2 border-black"
        />

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
        <Question className="min-w-[6rem] w-24 h-24 py-4" />
      </button>
    </motion.div>
  );
};
