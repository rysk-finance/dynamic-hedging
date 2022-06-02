import React from "react";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { ReturnLineChart } from "./ReturnLineChart";
import { Serie } from "@nivo/line";
import { OptionsTradingActionType, Option } from "../../state/types";

// TODO(HC): Make this not dummy data...
const DUMMY_DATA: Serie[] = [
  {
    id: "return",
    data: Array.from(Array(100).keys()).map((x) => ({
      x: x,
      y: Math.max(50, x),
    })),
  },
];

export const Purchase: React.FC = () => {
  const {
    state: { selectedOption },
    dispatch,
  } = useOptionsTradingContext();

  const setSelectedOption = (option: Option | null) => {
    dispatch({ type: OptionsTradingActionType.SET_SELECTED_OPTION, option });
  };

  return selectedOption ? (
    <div>
      <div className="w-full flex justify-end">
        <button className="text-xl" onClick={() => setSelectedOption(null)}>
          ✕
        </button>
      </div>
      <div className="mb-16">
        <h4>Buy: {selectedOption.type}</h4>
        <p>Strike: {selectedOption.strike}</p>
        <p>IV: {selectedOption.IV}</p>
        <p>Delta: {selectedOption.delta}</p>
        <p>Price: {selectedOption.price}</p>
      </div>
      <div className="h-32 w-full border-black border-2">
        <ReturnLineChart data={DUMMY_DATA} />
      </div>
    </div>
  ) : null;
};
