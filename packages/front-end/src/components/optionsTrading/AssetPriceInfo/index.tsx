import dayjs from "dayjs";

import { ETHPriceIndicator } from "src/components/shared/ETHPriceIndicator";
import { useGlobalContext } from "src/state/GlobalContext";

export const AssetPriceInfo = () => {
  const {
    state: { ethPriceUpdateTime },
  } = useGlobalContext();

  return (
    <div className="flex justify-stretch items-stretch">
      <img
        src="/icons/ethereum.svg"
        alt="Ethereum logo"
        className="px-6 py-4 border-r-2 border-black"
      />
      <div className="flex items-center justify-between grow px-4">
        <span className="my-auto">
          <h4 className="font-bold">{`Ether`}</h4>
          <small className="text-gray-600 text-xs">
            {`Latest Update: ${dayjs(ethPriceUpdateTime).format("HH:mm:ss A")}`}
          </small>
        </span>

        <ETHPriceIndicator />
      </div>
    </div>
  );
};
