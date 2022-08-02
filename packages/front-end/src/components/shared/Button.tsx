import React from "react";

type ButtonProps = {
  color?: "white" | "black";
};

export const Button: React.FC<
  React.DetailedHTMLProps<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > &
    ButtonProps
> = ({ color, ...props }) => {
  return (
    <button
      {...props}
      className={`border-black border-2  text-md px-2 py-1 ${
        color === "black" ? "bg-black text-white" : "bg-white text-black"
      } ${props.className ?? ""} ${
        props.disabled ? "!bg-gray-300 cursor-default" : ""
      }`}
    />
  );
};
