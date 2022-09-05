import React from "react";
import { useGlobalContext } from "../../state/GlobalContext";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import {
  Option,
  OptionsTradingActionType,
  OptionType,
} from "../../state/types";
import { Option as ListOption } from "../../types";
import { Card } from "../shared/Card";
import { ETHPriceIndicator } from "../shared/ETHPriceIndicator";
import { RadioButtonList } from "../shared/RadioButtonList";
import { CustomOptionOrder } from "./CustomOptionOrder";
import { OptionsTable } from "./OptionsTable";
import { Purchase } from "./Purchase";

const optionTypeOptions: ListOption<OptionType>[] = [
  { key: OptionType.CALL, label: "Calls", value: OptionType.CALL },
  { key: OptionType.PUT, label: "Puts", value: OptionType.PUT },
];

export const OptionsTradingContent = () => {
  const {
    state: { ethPriceUpdateTime },
  } = useGlobalContext();

  const {
    dispatch,
    state: { selectedOption, optionType },
  } = useOptionsTradingContext();

  const setOptionType = (optionType: OptionType) => {
    dispatch({ type: OptionsTradingActionType.SET_OPTION_TYPE, optionType });
  };

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
        <Card
          tabs={[
            {
              label: "ETH.option",
              content: (
                <>
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
                          Late Update:{" "}
                          {ethPriceUpdateTime?.toLocaleTimeString("en-US")}
                        </p>
                      </div>
                      <ETHPriceIndicator />
                    </div>
                  </div>
                  <div className="w-full">
                    <div className="bg-black p-2 text-white">
                      <p>
                        <b>1. Select Type</b>
                      </p>
                    </div>
                    <div className="border-b-2 border-black mb-4">
                      <RadioButtonList
                        options={optionTypeOptions}
                        selected={optionType}
                        setSelected={setOptionType}
                        removeOuterBorder
                      />
                    </div>
                  </div>
                  <div className="flex grow items-stretch">
                    <div className="bg-bone rounded-bl-lg flex flex-col min-w-[420px]">
                      <div className="grow rounded-bl-lg grow">
                        <CustomOptionOrder />
                      </div>
                    </div>
                    <div className="grow flex-col rounded-br-lg">
                      <div className="bg-black p-2 text-white ">
                        <p>
                          <b>2b. Options</b>
                        </p>
                      </div>
                      <div className="grow border-black rounded-br-lg">
                        <OptionsTable />
                      </div>
                    </div>
                  </div>
                  <div className="py-2 border-y-2 border-black" />
                  <div className="grow rounded-br-lg flex flex-col">
                    <div className="bg-black p-2 text-white flex justify-between">
                      <p>
                        <b>3. Complete order</b>
                      </p>
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
                </>
              ),
            },
          ]}
        ></Card>
      </div>
    </>
  );
};
