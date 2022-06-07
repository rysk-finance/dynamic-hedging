import React, { useState } from "react";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { ReturnLineChart } from "./ReturnLineChart";
import { Serie } from "@nivo/line";
import { OptionsTradingActionType, Option } from "../../state/types";
import { Button } from "../shared/Button";
import { TextInput } from "../shared/TextInput";

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

  const [uiOrderSize, setUIOrderSize] = useState("");

  const buyIsDisabled = !uiOrderSize;

  return (
    <div>
      {selectedOption ? (
        <>
          <div className="w-full flex justify-between relative">
            <button
              className="absolute text-xl top-4 right-4"
              onClick={() => setSelectedOption(null)}
            >
              ✕
            </button>
            <div className="w-1/2 border-r-2 border-black">
              <div className="w-full p-4">
                <div className="flex items-center">
                  <h4 className="font-parabole mr-2 pb-2">Option:</h4>
                  {selectedOption && (
                    <p className="pb-1">{selectedOption.type}</p>
                  )}
                </div>
                <p>Strike: {selectedOption.strike}</p>
                <p>IV: {selectedOption.IV}</p>
                <p>Delta: {selectedOption.delta}</p>
                <p>Price: {selectedOption.price}</p>
              </div>
              <div className="w-full ">
                <TextInput
                  value={uiOrderSize}
                  setValue={setUIOrderSize}
                  className="text-right border-x-0 w-full"
                  iconLeft={
                    <div className="px-2 flex items-center h-full">
                      <p className="text-gray-600">Shares</p>
                    </div>
                  }
                  numericOnly
                  maxNumDecimals={2}
                />
              </div>
              <div className="w-full">
                <div className="w-full -mb-1">
                  <div className="w-full p-4 flex items-center">
                    <h4 className="font-parabole mr-2 pb-1">Total price:</h4>
                    {uiOrderSize && (
                      <p>{Number(uiOrderSize) * selectedOption.price} USDC</p>
                    )}
                  </div>
                </div>
              </div>
              <Button
                disabled={buyIsDisabled}
                className={`w-full border-b-0 border-x-0 !py-4 !bg-black text-white ${
                  buyIsDisabled ? "!bg-gray-300" : ""
                }`}
              >
                Buy
              </Button>
            </div>
          </div>
        </>
      ) : (
        <p className="p-4">Select an option first</p>
      )}
    </div>
  );
};
