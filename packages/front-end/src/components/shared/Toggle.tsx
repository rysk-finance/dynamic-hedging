import React from "react";

type ToggleSize = "sm" | "md" | "lg";

type ToggleProps = {
  value: boolean;
  setValue: (value: boolean) => void;
  size?: ToggleSize;
};

const SIZE_MAP: Record<ToggleSize, number> = {
  sm: 15,
  md: 25,
  lg: 35,
};

const TEXT_SIZE_MAP: Record<ToggleSize, number> = {
  sm: 12,
  md: 16,
  lg: 20,
};
export const Toggle: React.FC<ToggleProps> = ({
  value,
  setValue,
  size = "md",
}) => {
  return (
    <div className="flex items-center">
      <p className={`mr-2`} style={{ fontSize: TEXT_SIZE_MAP[size] }}>
        {value ? "on" : "off"}
      </p>
      <button
        className={`border-black border-2 rounded-full flex items-center`}
        style={{ width: SIZE_MAP[size] * 2, height: SIZE_MAP[size] }}
        onClick={() => setValue(!value)}
      >
        <div
          className={`${
            value ? `bg-green-500` : "bg-red-500"
          } rounded-full mx-[${
            size === "lg" ? 2 : size === "md" ? 1 : 0
          }px] transition-transform`}
          style={{
            transform: `translateX(${value ? SIZE_MAP[size] : 0}px)`,
            height: SIZE_MAP[size] - SIZE_MAP[size] / 4,
            width: SIZE_MAP[size] - SIZE_MAP[size] / 4,
          }}
        ></div>
      </button>
    </div>
  );
};
