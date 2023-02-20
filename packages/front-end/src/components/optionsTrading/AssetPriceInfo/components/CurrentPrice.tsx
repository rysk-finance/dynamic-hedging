import type { CurrentPriceProps } from "../types";

import dayjs from "dayjs";

export const CurrentPrice = ({ price, latestUpdate }: CurrentPriceProps) => {
  return (
    <div className="flex items-center justify-between grow px-4">
      <span className="flex flex-col">
        <h4 className="font-medium font-dm-mono mb-1">{`Ether: $ ${price}`}</h4>
        <small className="text-gray-600 text-xs text-left">
          {`Latest Update: ${dayjs(latestUpdate).format("HH:mm:ss A")}`}
        </small>
      </span>
    </div>
  );
};
