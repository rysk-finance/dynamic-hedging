import { Option } from "../../types";
import { Button } from "./Button";

interface RadioButtonListProps<T> {
  options: Option<T>[];
  selected: T | null;
  setSelected: (value: T) => void;
  predicate?: (arg: T) => boolean;
  removeOuterBorder?: boolean;
}

type RadioButtonListType<T = any> = RadioButtonListProps<T>;

export const RadioButtonList = ({
  options,
  selected,
  setSelected,
  predicate,
  removeOuterBorder = false,
}: RadioButtonListType) => {
  return (
    <div className={`flex w-full pr-[2px]`}>
      {options.map((option, index) => {
        const isSelected = predicate
          ? predicate(option.value)
          : option.value === selected;
        return (
          <Button
            key={option.key}
            className={`${
              isSelected ? "" : "!bg-gray-500"
            }  basis-0 grow mr-[-2px] ${
              removeOuterBorder
                ? `border-y-0 ${
                    index === 0
                      ? "border-l-0"
                      : index === options.length - 1
                      ? "border-r-0"
                      : ""
                  }`
                : ""
            }`}
            onClick={() => setSelected(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
};
