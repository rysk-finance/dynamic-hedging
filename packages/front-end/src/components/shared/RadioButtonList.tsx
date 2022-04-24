import React from "react";
import { Option } from "../../types";
import { Button } from "./Button";

type RadioButtonListProps<T> = {
  options: Option<T>[];
  selected: T;
  setSelected: (value: T) => void;
};

type RadioButtonListType<T = any> = React.FC<RadioButtonListProps<T>>;

export const RadioButtonList: RadioButtonListType = ({
  options,
  selected,
  setSelected,
}) => {
  return (
    <div className={`flex w-full`}>
      {options.map((option, index) => (
        <Button
          className={`${
            option.value !== selected ? "bg-gray-500" : ""
          }  basis-0 grow`}
          onClick={() => setSelected(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
};
