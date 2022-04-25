import React, { useEffect, useState } from "react";
import { useGlobalContext } from "../../state/GlobalContext";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import {
  Option,
  OptionsTradingActionType,
  OptionType,
} from "../../state/types";

const suggestedCallOptionPriceDiff = [-200, 0, 200, 400, 600, 800, 1000];
const suggestedPutOptionPriceDiff = [-1000, -800, -600, -400, -200, 0, 200];

export const OptionsTable: React.FC = () => {
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
    state: { optionType, customOptionStrikes },
    dispatch,
  } = useOptionsTradingContext();

  const [suggestions, setSuggestions] = useState<Option[] | null>(null);

  useEffect(() => {
    if (cachedEthPrice) {
      const diffs =
        optionType === OptionType.CALL
          ? suggestedCallOptionPriceDiff
          : suggestedPutOptionPriceDiff;

      const strikes = [
        ...diffs.map<number>((diff) =>
          Number((cachedEthPrice + diff).toFixed(0))
        ),
        ...customOptionStrikes,
      ].sort((a, b) => a - b);
      const suggestions: Option[] = strikes.map<Option>((strike) => {
        return {
          strike: strike,
          IV: 100,
          delta: 0.5,
          price: 100,
          type: optionType,
        };
      });
      setSuggestions(suggestions);
    }
  }, [cachedEthPrice, suggestions, optionType, customOptionStrikes]);

  const setSelectedOption = (option: Option) => {
    dispatch({ type: OptionsTradingActionType.SET_SELECTED_OPTION, option });
  };

  return (
    <table className="w-full">
      <tr className="text-left">
        <th className="pl-4">Strike ($)</th>
        <th>IV</th>
        <th>Delta</th>
        <th className="pr-4">Price ($)</th>
      </tr>
      {suggestions?.map((option, index) => (
        <tr
          className={`h-12 ${
            index % 2 === 0 ? "bg-gray-300" : ""
          } cursor-pointer`}
          onClick={() => setSelectedOption(option)}
        >
          <td className="pl-4">{option.strike}</td>
          <td>
            {option.IV}
            {"%"}
          </td>
          <td>
            {option.delta}
            {"%"}
          </td>
          <td className="pr-4">{option.price}</td>
        </tr>
      ))}
    </table>
  );
};
