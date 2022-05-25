import React from "react";

type ToggleProps = {
  value: boolean;
  setValue: (value: boolean) => void;
};

export const Toggle: React.FC<ToggleProps> = ({ value, setValue }) => {
  return (
    <div className="flex items-center">
      <p className="mr-2">{value ? "on" : "off"}</p>
      <button
        className="border-black border-2 rounded-full w-[50px] h-[25px] flex items-center"
        onClick={() => setValue(!value)}
      >
        <div
          className={`${
            value ? "bg-green-500 translate-x-[24px]" : "bg-red-500"
          } rounded-full h-[20px] w-[20px] mx-[1px] transition-transform`}
        ></div>
      </button>
    </div>
  );
};
