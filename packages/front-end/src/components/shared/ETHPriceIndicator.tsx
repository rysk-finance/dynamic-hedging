import React, { useEffect } from "react";
import { useUpdateEthPrice } from "../../hooks/useUpdateEthPrice";
import { useGlobalContext } from "../../state/GlobalContext";

export const ETHPriceIndicator: React.FC = () => {
  const {
    state: { ethPrice, eth24hChange },
  } = useGlobalContext();
  const { updatePrice } = useUpdateEthPrice();

  useEffect(() => {
    updatePrice();
  }, [updatePrice]);

  return (
    <button
      onClick={updatePrice}
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
