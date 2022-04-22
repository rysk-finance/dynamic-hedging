import React from "react";

export const Button: React.FC<
  React.DetailedHTMLProps<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  >
> = (props) => {
  return (
    <button
      {...props}
      className={`border-black border-2 px-2 py-1 hover:animate-border-round ${
        props.className ?? ""
      }`}
    />
  );
};
