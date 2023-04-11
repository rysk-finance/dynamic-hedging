import type { PropsWithChildren } from "react";

import { useSearchParams } from "react-router-dom";

import { Change, Close } from "src/Icons";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType, OptionChainModalActions } from "src/state/types";

interface HeaderProps extends PropsWithChildren {
  changeVisible?: boolean;
}

export const Header = ({ children, changeVisible = false }: HeaderProps) => {
  const {
    dispatch,
    state: {
      options: { isOperator },
      selectedOption,
    },
  } = useGlobalContext();

  const [_, setSearchParams] = useSearchParams();

  const closeModal = () => {
    dispatch({
      type: ActionType.RESET_OPTIONS_CHAIN_STATE,
    });
    setSearchParams({});
  };

  const changeModal = () => {
    const visible =
      selectedOption?.buyOrSell === "buy" && isOperator
        ? OptionChainModalActions.SELL
        : selectedOption?.buyOrSell === "buy"
        ? OptionChainModalActions.OPERATOR
        : OptionChainModalActions.BUY;

    dispatch({
      type: ActionType.CHANGE_FROM_BUYING_OR_SELLING,
      visible,
    });
  };

  const changeTitle =
    selectedOption?.buyOrSell === "buy"
      ? "Click to change to selling."
      : "Click to change to buying.";

  return (
    <span className="grid grid-cols-10 bg-black text-white bg-[url('./assets/circle-lines.png')] bg-no-repeat bg-[top_left_-50%] bg-contain">
      <h2 className="col-span-6 col-start-3 text-xl font-medium text-center py-4">
        {children}
      </h2>
      {changeVisible && (
        <button
          className="col-span-1 p-2"
          onClick={changeModal}
          title={changeTitle}
        >
          <Change className="text-white" />
        </button>
      )}
      <button
        className={`${changeVisible ? "" : "col-start-10"} col-span-1 p-2`}
        onClick={closeModal}
        title="Click to close the modal."
      >
        <Close className="text-white" />
      </button>
    </span>
  );
};
