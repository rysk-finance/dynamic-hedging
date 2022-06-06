import React, { useState } from "react";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { OptionsTradingActionType, OptionType } from "../../state/types";
import { RadioButtonList } from "../shared/RadioButtonList";
import { Option } from "../../types";
import { ExpiryDatePicker } from "./ExpiryDatePicker";
import { TextInput } from "../shared/TextInput";
import { Button } from "../shared/Button";

const optionTypeOptions: Option<OptionType>[] = [
  { key: OptionType.CALL, label: "Calls", value: OptionType.CALL },
  { key: OptionType.PUT, label: "Puts", value: OptionType.PUT },
];

export const CustomOptionOrder: React.FC = () => {
  const {
    state: { optionType, optionParams },
    dispatch,
  } = useOptionsTradingContext();

  const [uiStrikePrice, setUIStrikePrice] = useState("");

  const {
    state: { expiryDate },
  } = useOptionsTradingContext();

  const setOptionType = (optionType: OptionType) => {
    dispatch({ type: OptionsTradingActionType.SET_OPTION_TYPE, optionType });
  };

  const handleSubmit = () => {
    dispatch({
      type: OptionsTradingActionType.ADD_CUSTOM_STRIKE,
      strike: Number(uiStrikePrice),
    });
    setUIStrikePrice("");
  };

  const submitIsDisabled = !(uiStrikePrice && expiryDate);

  return (
    <div className="w-full min-w-[420px]">
      <div className="bg-black p-2 text-white border-r-2 border-white">
        <p>Select Type</p>
      </div>
      <div className="mb-4 border-b-2 border-black">
        <RadioButtonList
          options={optionTypeOptions}
          selected={optionType}
          setSelected={setOptionType}
          removeOuterBorder
        />
      </div>
      <div className="bg-black p-2 text-white border-white">
        <p>Select Expiry</p>
      </div>
      <div className="mb-4">
        <ExpiryDatePicker />
      </div>
      <div>
        <div className="bg-black p-2 text-white border-white">
          <p>Add a custom strike</p>
        </div>
        <div className="flex flex-col px-4 mb-4">
          <div className="flex items-center">
            <h4 className="font-parabole mr-2 pb-1">Custom Strike:</h4>
            {uiStrikePrice && <p>{uiStrikePrice} USDC</p>}
          </div>
          <p className="text-gray-500 text-xs">
            Min: $
            {optionParams
              ? optionType === OptionType.CALL
                ? optionParams.minCallStrikePrice.toString()
                : optionParams.maxCallStrikePrice.toString()
              : ""}{" "}
            / Max: $
            {optionParams
              ? optionType === OptionType.CALL
                ? optionParams.minPutStrikePrice.toString()
                : optionParams.maxPutStrikePrice.toString()
              : ""}
          </p>
        </div>
        <div className="mb-4">
          <TextInput
            value={uiStrikePrice}
            setValue={setUIStrikePrice}
            className="text-right border-x-0 w-full"
            iconLeft={
              <div className="px-2 flex items-center h-full">
                <p className="text-gray-600">$</p>
              </div>
            }
            numericOnly
          />
        </div>
        <Button
          disabled={submitIsDisabled}
          className={`!py-4 w-full !bg-black text-white mb-4 border-x-0 ${
            submitIsDisabled && "!bg-gray-300"
          }`}
          onClick={handleSubmit}
        >
          Add
        </Button>
      </div>
    </div>
  );
};
