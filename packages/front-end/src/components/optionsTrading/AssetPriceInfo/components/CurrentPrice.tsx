import dayjs from "dayjs";
import { useMemo } from "react";

import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { RyskTooltip } from "src/components/shared/RyskToolTip";
import { useGlobalContext } from "src/state/GlobalContext";
import { usePaused } from "../hooks/usePaused";

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

  const [paused] = usePaused();

  const warning = useMemo(
    () => utilisationHigh && !dhvBalance,
    [utilisationHigh, dhvBalance]
  );

  return (
    <div className="flex items-center justify-between grow px-4">
      <RyskTooltip
        content="The current Ether price, balance of the DHV liquidity pool, system status and the time of the last price update."
        disabled={!tutorialMode}
      >
        <span className="flex flex-col">
          <h4 className="flex font-medium font-dm-mono text-lg 2xl:text-xl before:content-['Ether:_$'] before:mr-1">
            <RyskCountUp value={ethPrice} />
          </h4>

          <small
            className={`text-xs mt-2 ${
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

          <small className="text-gray-600 text-xs">
            {`Latest Price Update: ${dayjs(ethPriceUpdateTime).format(
              "HH:mm:ss A"
            )}`}
          </small>

          <small
            className={`text-xs ${paused ? "text-red-500" : "text-gray-600"}`}
          >
            {`System Status: ${paused ? "Paused" : "Operational"}`}
          </small>
        </span>
      </RyskTooltip>
    </div>
  );
};
