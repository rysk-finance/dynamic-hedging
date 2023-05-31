import dayjs from "dayjs";
import { useBlockNumber } from "wagmi";

import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { Refresh } from "src/Icons";
import { useGlobalContext } from "src/state/GlobalContext";

export const CurrentPrice = () => {
  const {
    state: { ethPrice, ethPriceUpdateTime },
  } = useGlobalContext();

  const { data: blockHeight } = useBlockNumber({ watch: true });

  return (
    <div className="flex items-center justify-between grow px-4">
      <span className="flex flex-col">
        <h4 className="flex font-medium font-dm-mono text-lg lg:text-xl before:content-['Ether:_$'] before:mr-1">
          <RyskCountUp value={ethPrice || 0} />
          <Refresh className="w-6 h-6 ml-2" />
        </h4>

        <small className="text-gray-600 text-xs text-left my-1">
          {`Block Height: `}
          <RyskCountUp format="Integer" value={blockHeight || 0} />
        </small>

        <small className="text-gray-600 text-xs text-left">
          {`Latest Update: ${dayjs(ethPriceUpdateTime).format("HH:mm:ss A")}`}
        </small>
      </span>
    </div>
  );
};
