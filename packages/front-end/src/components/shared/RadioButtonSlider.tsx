import React from "react";
import { Option } from "../../types";

type RadioButtonSliderProps<T> = {
  options: Option<T>[];
  selected: T | null;
  setSelected: (value: T) => void;
  predicate?: (arg: T) => boolean;
  selectedClassName?: string;
  deselectedClassName?: string;
};

type RadioButtonSliderType<T = any> = React.FC<RadioButtonSliderProps<T>>;

export const RadioButtonSlider: RadioButtonSliderType = ({
  options,
  selected,
  setSelected,
  predicate,
  selectedClassName,
  deselectedClassName,
}) => {
  return (
    <div className={`flex w-full box-content relative`}>
      {options.map((option) => {
        const isSelected = predicate
          ? predicate(option.value)
          : option.value === selected;
        return (
          // TODO(HC): Can add some animation here to move slide the background between
          // selected buttons.
          <button
            key={option.key}
            className={`px-4 py-2 rounded-full border-2 outline-none ${
              isSelected
                ? `bg-white border-black box-border my-[-2px] ${selectedClassName}`
                : `${deselectedClassName}`
            }`}
            onClick={() => setSelected(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
