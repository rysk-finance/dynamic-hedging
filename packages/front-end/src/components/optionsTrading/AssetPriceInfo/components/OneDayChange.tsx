import type { RefObject } from "react";

import type { OneDayChangeProps } from "../types";

import NumberFormat from "react-number-format";

import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { toTwoDecimalPlaces as round } from "src/utils/rounding";

export const OneDayChange = ({ low, change, high }: OneDayChangeProps) => {
  const barWidthColor =
    change < 0 ? "right-1/2 bg-red-500" : "left-1/2 bg-green-500";
  const barEndColorPosition =
    change < 0 ? "bg-red-900 mr-auto" : "bg-green-900 ml-auto";
  const widthChunk = change * (50 / (Math.ceil(Math.abs(change) / 5) * 5));

  return (
    <div className="flex flex-col justify-center px-4 w-1/2">
      <div className="flex justify-between pb-1">
        <small className="text-gray-600 text-xs">{`24hr Low`}</small>
        <small className="text-gray-600 text-xs">{`24hr High`}</small>
      </div>

      <div className="flex justify-between font-dm-mono text-xs xl:text-base pb-1">
        <NumberFormat
          value={low}
          displayType="text"
          decimalScale={2}
          fixedDecimalScale
          renderText={(value) => (
            <p className="text-red-500 before:content-['$'] before:mr-1">
              {value}
            </p>
          )}
          thousandSeparator=","
        />

        <p className="text-gray-600 after:content-['%'] after:ml-1">
          <RyskCountUp value={round(change) || 0} />
        </p>

        <NumberFormat
          value={high}
          displayType="text"
          decimalScale={2}
          fixedDecimalScale
          renderText={(value) => (
            <p className="text-green-500 before:content-['$'] before:mr-1">
              {value}
            </p>
          )}
          thousandSeparator=","
        />
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
