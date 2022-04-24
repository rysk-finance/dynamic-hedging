import React from "react";

export const TextInput: React.FC<
  React.DetailedHTMLProps<
    React.InputHTMLAttributes<HTMLInputElement>,
    HTMLInputElement
  >
> = (props) => {
  return (
    <input
      type="text"
      {...props}
      className={`border-black border-2 w-full p-2 ${props.className ?? ""}`}
    />
  );
};
