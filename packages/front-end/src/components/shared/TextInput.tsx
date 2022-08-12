import { BigNumber, ethers } from "ethers";
import React from "react";

type TextInputProps = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
> & {
  iconLeft?: React.ReactElement;
  value: string;
  setValue: (value: string) => void;
  numericOnly?: boolean;
  maxNumDecimals?: number;
  maxValue?: BigNumber;
  maxValueDecimals?: number;
};

export const TextInput: React.FC<TextInputProps> = ({
  value,
  setValue,
  iconLeft,
  numericOnly = false,
  maxNumDecimals,
  maxValue,
  maxValueDecimals,
  ...props
}) => {
  const setter = (value: string) => {
    if (numericOnly) {
      const isWithinDecimalLimit =
        maxNumDecimals && value.includes(".")
          ? value.split(".")[1].length <= maxNumDecimals
          : true;
      const isSmallerThanMaxValue = maxValue
        ? Number(value) <=
          Number(ethers.utils.formatUnits(maxValue, maxValueDecimals))
        : true;
      if (
        value === "" ||
        (!isNaN(Number(value)) && isWithinDecimalLimit && isSmallerThanMaxValue)
      ) {
        setValue(value);
      }
    } else {
      setValue(value);
    }
  };
  return (
    <div className="relative">
      <input
        type="text"
        {...props}
        className={`border-black border-2 w-full p-2 ${
          props.className ?? ""
        } outline-none`}
        value={value}
        onChange={(event) => setter(event.target.value)}
      />
      {iconLeft && (
        <div className="h-full absolute left-0 top-0 w-fit">{iconLeft}</div>
      )}
    </div>
  );
};
