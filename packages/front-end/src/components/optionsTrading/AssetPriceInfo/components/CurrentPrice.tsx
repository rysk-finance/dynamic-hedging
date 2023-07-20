import dayjs from "dayjs";
import { useMemo } from "react";

import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { Refresh } from "src/Icons";
import { useGlobalContext } from "src/state/GlobalContext";
import { RyskTooltip } from "src/components/shared/RyskToolTip";

export const CurrentPrice = () => {
  const {
    state: {
      ethPrice,
      ethPriceUpdateTime,
      options: {
        liquidityPool: { remainingBeforeBuffer, utilisationHigh },
      },
      userTradingPreferences: { dhvBalance, tutorialMode },
    },
  } = useGlobalContext();

  const warning = useMemo(
    () => utilisationHigh && !dhvBalance,
    [utilisationHigh, dhvBalance]
  );

  return (
    <div className="flex items-center justify-between grow px-4">
      <RyskTooltip
        content="The current Ether price, balance of the DHV liquidity pool and the time of the last price update. You can click here to manually check the Ether price every 30 seconds."
        disabled={!tutorialMode}
      >
        <span className="flex flex-col">
          <h4 className="flex font-medium font-dm-mono text-lg lg:text-xl before:content-['Ether:_$'] before:mr-1">
            <RyskCountUp value={ethPrice || 0} />
            <Refresh className="w-6 h-6 ml-2" />
          </h4>

          <small
            className={`text-xs text-left mt-2 ${
              warning ? "text-red-500" : "text-gray-600"
            }`}
          >
            {warning ? (
              <>{`DHV utilisation is high. Some TXs may fail.`}</>
            ) : (
              <>
                {`Liquidity Pool Balance: $ `}
                <RyskCountUp value={remainingBeforeBuffer} />
              </>
            )}
          </small>

          <small className="text-gray-600 text-xs text-left">
            {`Latest Update: ${dayjs(ethPriceUpdateTime).format("HH:mm:ss A")}`}
          </small>
        </span>
      </RyskTooltip>
    </div>
  );
};
