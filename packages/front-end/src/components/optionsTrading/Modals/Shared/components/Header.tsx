import type { PropsWithChildren } from "react";

import { useSearchParams } from "react-router-dom";

import { Close } from "src/Icons";
import { useOptionsTradingContext } from "src/state/OptionsTradingContext";
import { OptionsTradingActionType } from "src/state/types";

export const Header = ({ children }: PropsWithChildren) => {
  const { dispatch } = useOptionsTradingContext();

  const [_, setSearchParams] = useSearchParams();

  const closeModal = () => {
    dispatch({
      type: OptionsTradingActionType.RESET,
    });
    setSearchParams({});
  };

  return (
    <span className="relative bg-black text-white bg-[url('./assets/circle-lines.png')] bg-no-repeat bg-[top_left_-50%] bg-contain">
      <h2 className="text-xl font-medium text-center py-4">{children}</h2>
      <button className="absolute top-0 right-0 w-12 p-2" onClick={closeModal}>
        <Close className="text-white" />
      </button>
    </span>
  );
};
