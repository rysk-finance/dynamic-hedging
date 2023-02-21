import type { RefObject } from "react";

import type { CurrentPriceProps } from "../types";

import dayjs from "dayjs";
import { useBlockNumber } from "wagmi";

import { RyskCountUp } from "src/components/shared/RyskCountUp";

export const CurrentPrice = ({ price, latestUpdate }: CurrentPriceProps) => {
  const { data: blockHeight } = useBlockNumber({ watch: true });

  return (
    <div className="flex items-center justify-between grow px-4">
      <span className="flex flex-col">
        <h4 className="font-medium font-dm-mono text-lg lg:text-xl before:content-['Ether:_$'] before:mr-1">
          <RyskCountUp value={price || 0} />
        </h4>

        <small className="text-gray-600 text-xs text-left my-1">
          {`Block Height: `}
          <RyskCountUp format="Integer" value={blockHeight || 0} />
        </small>

        <small className="text-gray-600 text-xs text-left">
          {`Latest Update: ${dayjs(latestUpdate).format("HH:mm:ss A")}`}
        </small>
      </span>
    </div>
  );
};
