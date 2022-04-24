import React from "react";

type TextInputProps = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
> & {
  iconLeft?: React.ReactElement;
  value: string;
  setValue: (value: string) => void;
  numericOnly?: boolean;
};

export const TextInput: React.FC<TextInputProps> = ({
  value,
  setValue,
  iconLeft,
  numericOnly = false,
  ...props
}) => {
  const setter = (value: string) => {
    if (numericOnly) {
      if (value === "" || Number(value)) {
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
        className={`border-black border-2 w-full p-2 ${props.className ?? ""}`}
        value={value}
        onChange={(event) => setter(event.target.value)}
      />
      {iconLeft && (
        <div className="h-full absolute left-0 top-0 w-fit">{iconLeft}</div>
      )}
    </div>
  );
};
