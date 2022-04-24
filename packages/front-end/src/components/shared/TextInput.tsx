import React from "react";

type TextInputProps = React.DetailedHTMLProps<
  React.InputHTMLAttributes<HTMLInputElement>,
  HTMLInputElement
> & { iconLeft?: React.ReactElement };

export const TextInput: React.FC<TextInputProps> = ({ iconLeft, ...props }) => {
  return (
    <div className="relative">
      <input
        type="text"
        {...props}
        className={`border-black border-2 w-full p-2 ${props.className ?? ""}`}
      />
      {iconLeft && (
        <div className="h-full absolute left-0 top-0 w-fit">{iconLeft}</div>
      )}
    </div>
  );
};
