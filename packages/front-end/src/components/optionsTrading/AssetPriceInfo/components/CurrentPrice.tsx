import type { RefObject } from "react";

import type { CurrentPriceProps } from "../types";

import dayjs from "dayjs";
import { useBlockNumber } from "wagmi";
import CountUp from "react-countup";

import { easeOutCubic } from "src/animation/easing";

export const CurrentPrice = ({ price, latestUpdate }: CurrentPriceProps) => {
  const { data: blockHeight } = useBlockNumber({ watch: true });

  return (
    <div className="flex items-center justify-between grow px-4">
      <span className="flex flex-col">
        <CountUp
          decimals={2}
          duration={0.3}
          easingFn={easeOutCubic}
          end={price || 0}
          prefix="Ether: $ "
          preserveValue
          separator=","
          useEasing
        >
          {({ countUpRef }) => (
            <h4
              className="font-medium font-dm-mono"
              ref={countUpRef as RefObject<HTMLHeadingElement>}
            />
          )}
        </CountUp>

        <CountUp
          duration={0.3}
          easingFn={easeOutCubic}
          end={blockHeight || 0}
          prefix="Block Height: "
          preserveValue
          separator=","
          useEasing
        >
          {({ countUpRef }) => (
            <small
              className="text-gray-600 text-xs text-left my-1"
              ref={countUpRef}
            />
          )}
        </CountUp>

        <small className="text-gray-600 text-xs text-left">
          {`Latest Update: ${dayjs(latestUpdate).format("HH:mm:ss A")}`}
        </small>
      </span>
    </div>
  );
};
