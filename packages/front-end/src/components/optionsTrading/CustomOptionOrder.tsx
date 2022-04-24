import React from "react";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { OptionsTradingActionType, OptionType } from "../../state/types";
import { RadioButtonList } from "../shared/RadioButtonList";
import { Option } from "../../types";

const optionTypeOptions: Option<OptionType>[] = [
  { label: "Calls", value: OptionType.CALL },
  { label: "Puts", value: OptionType.PUT },
];

export const CustomOptionOrder: React.FC = () => {
  const {
    state: { optionType },
    dispatch,
  } = useOptionsTradingContext();

  const setOptionType = (optionType: OptionType) => {
    dispatch({ type: OptionsTradingActionType.SET_OPTION_TYPE, optionType });
  };

  return (
    <div className="w-full">
      <RadioButtonList
        options={optionTypeOptions}
        selected={optionType}
        setSelected={setOptionType}
      />
    </div>
  );
};
