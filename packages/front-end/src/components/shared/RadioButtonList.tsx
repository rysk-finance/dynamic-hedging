import React from "react";
import { Option } from "../../types";
import { Button } from "./Button";

type RadioButtonListProps<T> = {
  options: Option<T>[];
  selected: T | null;
  setSelected: (value: T) => void;
  predicate?: (arg: T) => boolean;
};

type RadioButtonListType<T = any> = React.FC<RadioButtonListProps<T>>;

export const RadioButtonList: RadioButtonListType = ({
  options,
  selected,
  setSelected,
  predicate,
}) => {
  return (
    <div className={`flex w-full`}>
      {options.map((option, index) => {
        const isSelected = predicate
          ? predicate(option.value)
          : option.value === selected;
        return (
          <Button
            className={`${
              isSelected ? "" : "bg-gray-500"
            }  basis-0 grow mr-[-2px]`}
            onClick={() => setSelected(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
};
