import type { ToggleProps } from "./types";

export const Toggle = ({ children, isLeft }: ToggleProps) => (
  <>
    <small className="leading-6">{children}</small>
    <div className="relative w-8 h-4 ml-2 p-1 bg-bone-dark rounded-full shadow-[inset_0_0_10px_rgba(0,0,0,0.2)]">
      <div
        className={`absolute ${
          isLeft ? "left-[0.25rem] bg-cyan" : "left-[1.25rem] bg-gray-600"
        } h-2 w-2 rounded-full ease-in-out duration-200`}
      />
    </div>
  </>
);
