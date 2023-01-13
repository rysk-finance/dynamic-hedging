import { Option } from "../../types";

interface RadioButtonSliderProps<T> {
  options: Option<T>[];
  selected: T | null;
  setSelected: (value: T) => void;
  predicate?: (arg: T) => boolean;
  buttonClassName?: string;
  selectedClassName?: string;
  deselectedClassName?: string;
  buttonType?: "primary" | "secondary";
};

type RadioButtonSliderType<T = any> = RadioButtonSliderProps<T>;

export const RadioButtonSlider = ({
  options,
  selected,
  setSelected,
  predicate,
  buttonClassName = "",
  selectedClassName = "",
  deselectedClassName = "",
  buttonType = "primary",
}: RadioButtonSliderType) => {
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
            className={`group relative px-4 py-2 rounded-full border-2 outline-none ${
              isSelected
                ? `${
                    buttonType === "primary" ? "bg-white" : ""
                  } border-black box-border my-[-2px] ${buttonClassName} ${selectedClassName}`
                : `${deselectedClassName}`
            } ${option.disabled ? "text-gray-500 cursor-not-allowed" : ""}`}
            onClick={() => {
              if (!option.disabled) {
                setSelected(option.value);
              }
            }}
          >
            {option.label}
            {option.disabledTooltip && (
              <div
                className={`absolute p-2 bg-bone z-10 border-2 border-black top-[100%] right-0 text-black hidden ${
                  option.disabled ? "group-hover:block" : ""
                }`}
              >
                <p className="text-sm w-fit">{option.disabledTooltip}</p>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
