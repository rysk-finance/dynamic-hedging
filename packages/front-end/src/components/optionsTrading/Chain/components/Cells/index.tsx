import type {
  CellProps,
  DeltaProps,
  ExposureProps,
  IVProps,
  PositionProps,
  QuoteProps,
  StrikeProps,
} from "./types";

import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { Triangle } from "src/Icons";

export const Cell = ({ children, cellClasses }: CellProps) => {
  return (
    <td
      className={`py-4 xl:py-2.5 px-1 xl:px-2 group-hover/row:bg-green-100/50 ${cellClasses}`}
    >
      {children}
    </td>
  );
};

export const IV = ({ value }: IVProps) => {
  return (
    <span className={value ? "after:content-['%'] after:ml-1" : ""}>
      <RyskCountUp format="IV" value={value} />
    </span>
  );
};

export const Quote = ({ clickFn, disabled, value }: QuoteProps) => {
  const disabledClasses = disabled ? "cursor-not-allowed" : "cursor-pointer";
  const beforeClasses = value ? "before:content-['$'] before:mr-1" : "";

  return (
    <button
      className={`${disabledClasses} ${beforeClasses} py-4 xl:py-2.5 px-1 xl:px-2 w-full text-right`}
      onClick={clickFn}
      disabled={disabled}
    >
      <RyskCountUp value={value} />
    </button>
  );
};

export const Delta = ({ value }: DeltaProps) => {
  return (
    <span>
      <RyskCountUp value={value} />
    </span>
  );
};

export const Position = ({ clickFn, disabled, value }: PositionProps) => {
  return (
    <button
      className={`${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      } py-4 xl:py-2.5 px-1 xl:px-2 w-full text-right`}
      onClick={clickFn}
      disabled={disabled}
    >
      <RyskCountUp value={value} />
    </button>
  );
};

export const Exposure = ({ value }: ExposureProps) => {
  return (
    <span>
      <RyskCountUp value={value} />
    </span>
  );
};

export const Strike = ({
  callAtTheMoney,
  putAtTheMoney,
  value,
}: StrikeProps) => {
  return (
    <td className="relative text-center bg-bone-dark !border-0 font-medium py-4 xl:py-2.5 px-1 xl:px-2">
      {callAtTheMoney && (
        <Triangle className="absolute bottom-0 left-[-0.625rem] z-10 fill-green-500 w-5" />
      )}

      <span>
        <RyskCountUp value={value} format="Integer" />
      </span>

      {putAtTheMoney && (
        <Triangle className="absolute top-0 right-[-0.625rem] z-10 fill-green-500 w-5 rotate-180" />
      )}
    </td>
  );
};
