import type { RefObject } from "react";

import type { OneDayChangeProps } from "../types";

import CountUp from "react-countup";

import { easeOutCubic } from "src/animation/easing";
import { toTwoDecimalPlaces as round } from "src/utils/rounding";

export const OneDayChange = ({ low, change, high }: OneDayChangeProps) => {
  const barWidthColor =
    change < 0 ? "right-1/2 bg-red-500" : "left-1/2 bg-green-500";
  const barEndColorPosition =
    change < 0 ? "bg-red-900 mr-auto" : "bg-green-900 ml-auto";
  const widthChunk = change * (50 / (Math.ceil(Math.abs(change) / 5) * 5));

  return (
    <div className="flex flex-col justify-center w-1/3 px-4">
      <div className="flex justify-between">
        <small className="text-gray-600 text-xs">{`24hr Low`}</small>
        <small className="text-gray-600 text-xs">{`24hr High`}</small>
      </div>

      <div className="flex justify-between font-dm-mono">
        <p className="text-red-500">{`$ ${low}`}</p>
        <CountUp
          decimals={2}
          duration={0.3}
          easingFn={easeOutCubic}
          end={round(change) || 0}
          preserveValue
          suffix=" %"
          useEasing
        >
          {({ countUpRef }) => (
            <p
              className="text-gray-600"
              ref={countUpRef as RefObject<HTMLHeadingElement>}
            />
          )}
        </CountUp>
        <p className="text-green-500">{`$ ${high}`}</p>
      </div>

      <div className="relative flex justify-center w-full h-4 bg-bone-dark overflow-hidden">
        <div className="w-2 h-4 bg-white" />
        {Boolean(change) && (
          <div
            className={`absolute h-4 ease-in-out duration-300 ${barWidthColor}`}
            style={{ width: `calc(${Math.abs(widthChunk)}% + 1rem)` }}
          >
            <div className={`relative w-4 h-4 ${barEndColorPosition}`} />
          </div>
        )}
      </div>
    </div>
  );
};
