import { ethers } from "ethers";
import { useState } from "react";
import { BIG_NUMBER_DECIMALS, DECIMALS } from "../../config/constants";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { OptionsTradingActionType, OptionType } from "../../state/types";
import { Button } from "../shared/Button";
import { TextInput } from "../shared/TextInput";
import { ExpiryDatePicker } from "./ExpiryDatePicker";

export const CustomOptionOrder = () => {
  const {
    state: { optionType, optionParams },
    dispatch,
  } = useOptionsTradingContext();

  const [uiStrikePrice, setUIStrikePrice] = useState("");

  const {
    state: { expiryDate },
  } = useOptionsTradingContext();

  const handleSubmit = () => {
    dispatch({
      type: OptionsTradingActionType.ADD_CUSTOM_STRIKE,
      strike: Number(uiStrikePrice),
    });
    setUIStrikePrice("");
  };

  const strikeBigNumber = uiStrikePrice
    ? ethers.utils.parseUnits(uiStrikePrice, DECIMALS.RYSK)
    : null;

  const strikeIsWithinLimits =
    strikeBigNumber && optionParams
      ? optionType === OptionType.CALL
        ? optionParams.minCallStrikePrice.lte(strikeBigNumber) &&
          optionParams.maxCallStrikePrice.gte(strikeBigNumber)
        : optionParams.minPutStrikePrice.lte(strikeBigNumber) &&
          optionParams.maxPutStrikePrice.gte(strikeBigNumber)
      : false;

  const submitIsDisabled =
    !strikeIsWithinLimits || !(uiStrikePrice && expiryDate);

  return (
    <div className="w-full min-w-[420px]">
      <div className="bg-black p-2 text-white border-white border-r-2">
        <p>
          <b>2a. Custom Option</b>
        </p>
      </div>
      <div className="h-4 border-r-2 border-black" />
      <div className="bg-black p-2 text-white">
        <p>Select Expiry</p>
      </div>
      <div className="border-r-2 border-black">
        <div className="mb-4">
          <ExpiryDatePicker />
        </div>
        <div>
          <div className="bg-black p-2 text-white border-white">
            <p>Add a custom strike</p>
          </div>
          <div className="flex flex-col p-4">
            <div className="flex items-center">
              <h4 className="font-parabole mr-2 pb-1">Custom Strike:</h4>
              {uiStrikePrice && <p>{uiStrikePrice} USDC</p>}
            </div>
            <p className="text-gray-500 text-xs">
              Min: $
              {optionParams
                ? optionType === OptionType.CALL
                  ? optionParams.minCallStrikePrice
                      .div(BIG_NUMBER_DECIMALS.RYSK)
                      .toString()
                  : optionParams.minPutStrikePrice
                      .div(BIG_NUMBER_DECIMALS.RYSK)
                      .toString()
                : ""}{" "}
              / Max: $
              {optionParams
                ? optionType === OptionType.CALL
                  ? optionParams.maxCallStrikePrice
                      .div(BIG_NUMBER_DECIMALS.RYSK)
                      .toString()
                  : optionParams.maxPutStrikePrice
                      .div(BIG_NUMBER_DECIMALS.RYSK)
                      .toString()
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
              maxNumDecimals={6}
            />
          </div>
          <Button
            disabled={submitIsDisabled}
            className={`!py-4 w-full text-white mb-4 border-x-0 ${
              submitIsDisabled ? "!bg-gray-300" : "!bg-black"
            }`}
            onClick={handleSubmit}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
};
