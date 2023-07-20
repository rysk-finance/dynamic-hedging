import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback } from "react";

import { Ether, USDC } from "src/Icons";
import FadeInOut from "src/animation/FadeInOut";
import FadeInOutFixedDelay from "src/animation/FadeInOutFixedDelay";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { CurrentPrice } from "./components/CurrentPrice";
import { Error } from "./components/Error";
import { OneDayChange } from "./components/OneDayChange";
import { RyskTooltip } from "src/components/shared/RyskToolTip";

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
      userTradingPreferences: { tutorialMode },
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

  const ready = Boolean(!ethPriceError && ethPrice && ethPriceUpdateTime);

  return (
    <motion.div className="flex" {...FadeInOut()}>
      <button
        className="w-full h-24 flex items-stretch"
        onClick={handleManualUpdate}
      >
        <RyskTooltip
          content="Ethereum is the underlying asset."
          disabled={!tutorialMode}
        >
          <span className="flex min-w-[6rem] py-4 border-r-2 border-black">
            <div className="flex items-center justify-center mx-auto w-16 h-16 bg-[#ECEFF0]/90 rounded-full">
              <Ether aria-label="Ethereum logo" className="h-12" />
            </div>
          </span>
        </RyskTooltip>

        <AnimatePresence mode="wait">
          {ready && (
            <motion.div
              className="flex w-full bg-[url('./assets/white-ascii-50.png')] bg-cover bg-center"
              {...FadeInOutFixedDelay}
            >
              <CurrentPrice />

              <OneDayChange
                high={eth24hHigh}
                low={eth24hLow}
                change={eth24hChange}
              />
            </motion.div>
          )}

          {ethPriceError && <Error />}
        </AnimatePresence>

        <RyskTooltip
          content={
            <div>
              {`Rysk uses `}
              <a
                className="text-cyan-dark-compliant underline"
                href="https://www.circle.com/blog/arbitrum-usdc-now-available"
                rel="noopener noreferrer"
                target="_blank"
              >
                {`native USDC`}
              </a>
              {` for buying and selling options.`}
            </div>
          }
          disabled={!tutorialMode}
        >
          <span className="flex min-w-[6rem] ml-auto py-4 border-l-2 border-black">
            <USDC aria-label="USDC logo" className="mx-auto w-16 h-16" />
          </span>
        </RyskTooltip>
      </button>
    </motion.div>
  );
};
