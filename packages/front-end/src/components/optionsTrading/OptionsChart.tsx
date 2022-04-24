import React, { useEffect, useState } from "react";
import { useGlobalContext } from "../../state/GlobalContext";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { OptionType } from "../../state/types";

const suggestedCallOptionPriceDiff = [-200, 0, 200, 400, 600, 800, 1000];
const suggestedPutOptionPriceDiff = [-1000, -800, -600, -400, -200, 0, 200];

export const OptionsChart: React.FC = () => {
  const {
    state: { ethPrice },
  } = useGlobalContext();

  const [cachedEthPrice, setCachedEthPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!cachedEthPrice && ethPrice) {
      setCachedEthPrice(Number((ethPrice / 100).toFixed(0)) * 100);
    }
  }, [ethPrice, cachedEthPrice]);

  const {
    state: { optionType },
  } = useOptionsTradingContext();

  const [prices, setPrices] = useState<number[] | null>(null);

  useEffect(() => {
    if (cachedEthPrice) {
      setPrices(
        (optionType === OptionType.CALL
          ? suggestedCallOptionPriceDiff
          : suggestedPutOptionPriceDiff
        ).map((diff) => Number((cachedEthPrice + diff).toFixed(0)))
      );
    }
  }, [cachedEthPrice, prices, optionType]);

  return (
    <table className="w-full">
      <tr className="text-left">
        <th className="pl-4">Strike ($)</th>
        <th>IV</th>
        <th>Delta</th>
        <th className="pr-4">Price ($)</th>
      </tr>
      {prices?.map((price, index) => (
        <tr
          className={`h-12 ${
            index % 2 === 0 ? "bg-gray-300" : ""
          } cursor-pointer`}
        >
          <td className="pl-4">{price}</td>
          <td>90{"%"}</td>
          <td>50{"%"}</td>
          <td className="pr-4">100</td>
        </tr>
      ))}
    </table>
  );
};
