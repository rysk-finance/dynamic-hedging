import React from "react";
import { useGlobalContext } from "../../state/GlobalContext";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { OptionsTradingActionType, Option } from "../../state/types";
import { Card } from "../shared/Card";
import { ETHPriceIndicator } from "../shared/ETHPriceIndicator";
import { CustomOptionOrder } from "./CustomOptionOrder";
import { OptionsTable } from "./OptionsTable";
import { Purchase } from "./Purchase";

export const OptionsTradingContent = () => {
  const {
    state: { ethPriceUpdateTime },
  } = useGlobalContext();

  const {
    dispatch,
    state: { selectedOption },
  } = useOptionsTradingContext();

  const setSelectedOption = (option: Option | null) => {
    dispatch({ type: OptionsTradingActionType.SET_SELECTED_OPTION, option });
  };

  return (
    <>
      <div className="col-start-1 col-end-17 mb-16 flex justify-between">
        <h3>Trade Options</h3>
        <div className="flex items-start"></div>
      </div>
      <div className="col-start-1 col-end-17">
        <Card headerHeight={50} headerContent="ETH.option">
          <div className="flex justify-stretch items-stretch">
            <div className="px-6 py-4 border-r-2 border-black">
              <img src="/icons/ethereum.svg" />
            </div>
            <div className="flex items-center justify-between grow px-4">
              <div className="flex flex-col justify-around">
                <h4>
                  <b>Ether</b>
                </h4>
                <p className="text-gray-600 text-xs">
                  Late Update: {ethPriceUpdateTime?.toLocaleTimeString("en-US")}
                </p>
              </div>
              <ETHPriceIndicator />
            </div>
          </div>
          <div className="flex grow items-stretch">
            <div className="bg-bone rounded-bl-lg flex flex-col min-w-[420px]">
              <div className="bg-black p-2 text-white border-r-2 border-white">
                <p>Custom Option</p>
              </div>
              <div className="grow border-r-2 border-black rounded-bl-lg grow">
                <CustomOptionOrder />
              </div>
            </div>
            <div className="grow flex-col rounded-br-lg">
              <div className="bg-black p-2 text-white ">
                <p>Options</p>
              </div>
              <div className="grow border-black rounded-br-lg">
                <OptionsTable />
              </div>
            </div>
          </div>
          <div className="py-2 border-y-2 border-black" />
          <div className="grow rounded-br-lg flex flex-col">
            <div className="bg-black p-2 text-white flex justify-between">
              <p>Complete order</p>
              {selectedOption && (
                <button
                  className="text-xl top-4 right-4 text-white"
                  onClick={() => setSelectedOption(null)}
                >
                  ✕
                </button>
              )}
            </div>
            <div>
              <Purchase />
            </div>
          </div>
        </Card>
      </div>
    </>
  );
};
