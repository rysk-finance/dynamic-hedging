import dayjs from "dayjs";

import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { Refresh } from "src/Icons";
import { useGlobalContext } from "src/state/GlobalContext";

export const CurrentPrice = () => {
  const {
    state: {
      ethPrice,
      ethPriceUpdateTime,
      options: {
        liquidityPool: { remainingBeforeBuffer, utilisationHigh },
      },
    },
  } = useGlobalContext();

  return (
    <div className="flex items-center justify-between grow px-4">
      <span className="flex flex-col">
        <h4 className="flex font-medium font-dm-mono text-lg lg:text-xl before:content-['Ether:_$'] before:mr-1">
          <RyskCountUp value={ethPrice || 0} />
          <Refresh className="w-6 h-6 ml-2" />
        </h4>

        <small
          className={`text-xs text-left mt-2 ${
            utilisationHigh ? "text-red-500" : "text-gray-600"
          }`}
        >
          {utilisationHigh ? (
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
    </div>
  );
};
