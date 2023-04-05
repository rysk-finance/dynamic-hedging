import { useEffect } from "react";

import { useUpdateEthPrice } from "../../hooks/useUpdateEthPrice";
import { useGlobalContext } from "../../state/GlobalContext";

export const ETHPriceIndicator = () => {
  const {
    state: { ethPrice, eth24hChange },
  } = useGlobalContext();
  const { updatePriceData } = useUpdateEthPrice();

  useEffect(() => {
    updatePriceData();
  }, [updatePriceData]);

  useEffect(() => {
    // Refreshing the price every 60 seconds to force a recalculation of premiums.
    // Would probably be better if we used a websocket once we find an efficient way
    // to query all of the data from the graph.
    const priceCheckInternal = setInterval(() => {
      updatePriceData();
    }, 60000);

    return () => clearInterval(priceCheckInternal);
  }, []);

  return (
    <button
      onClick={updatePriceData}
      className="py-2 px-4 flex justify-between w-fit cursor-pointer"
    >
      <p className="pr-8">ETH</p>
      <p className="pr-8">${ethPrice}</p>
      {eth24hChange !== null && (
        <p
          className={`${eth24hChange >= 0 ? "text-green-600" : "text-red-600"}`}
        >
          {eth24hChange >= 0 ? "▲" : "▼"}
          {eth24hChange.toFixed(2)}%
        </p>
      )}
    </button>
  );
};
