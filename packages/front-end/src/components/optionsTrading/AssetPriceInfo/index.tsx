import { AnimatePresence, motion } from "framer-motion";

import FadeInOut from "src/animation/FadeInOut";
import FadeInOutFixedDelay from "src/animation/FadeInOutFixedDelay";
import { RyskFavicon } from "src/Icons";
import { useGlobalContext } from "src/state/GlobalContext";
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
  } = useGlobalContext();

  const [update] = usePrice();

  const ready = Boolean(!ethPriceError && ethPrice && ethPriceUpdateTime);

  return (
    <motion.button
      className="w-full h-24 flex items-stretch"
      onClick={update}
      {...FadeInOut()}
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
            <CurrentPrice price={ethPrice} latestUpdate={ethPriceUpdateTime} />

            <OneDayChange
              high={eth24hHigh}
              low={eth24hLow}
              change={eth24hChange}
            />
          </motion.div>
        )}

        {ethPriceError && <Error />}
      </AnimatePresence>

      <RyskFavicon className="min-w-[6rem] w-24 h-24 py-4 ml-auto border-l-2 border-black" />
    </motion.button>
  );
};
