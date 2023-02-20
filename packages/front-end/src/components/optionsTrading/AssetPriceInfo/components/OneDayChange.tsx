import type { OneDayChangeProps } from "../types";

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
        <p className="text-gray-600">{`${round(change)} %`}</p>
        <p className="text-green-500">{`$ ${high}`}</p>
      </div>

      <div className="relative flex justify-center w-full h-4 bg-bone-dark overflow-hidden">
        <div className="w-2 h-4 bg-white" />
        <div
          className={`absolute h-4 ease-in-out duration-300 ${barWidthColor}`}
          style={{ width: `${Math.abs(widthChunk)}%` }}
        >
          <div className={`relative w-4 h-4 ${barEndColorPosition}`} />
        </div>
      </div>
    </div>
  );
};
