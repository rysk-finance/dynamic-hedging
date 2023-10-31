import { useEffect } from "react";

import { useGlobalContext } from "src/state/GlobalContext";

import { ActionType, OptionChainModalActions } from "src/state/types";

/**
 * Hook that checks query params and state to determine if
 * the modal should be visible.
 *
 * The buy/sell modals are keyed from the `selectedOption` state variable.
 * The closing modals are keyed from the `closingOption` state variable.
 * The collateral adjustment modal is keyed from the `adjustingOption` state variable.
 * Strategy modals are not triggered from here as they have no preset state.
 *
 * Returns a boolean value for the modal state.
 *
 * @returns readonly [OptionChainModalActions | undefined]
 */
export const useModal = () => {
  const {
    state: {
      adjustingOption,
      closingOption,
      optionChainModalOpen,
      options: { activeExpiry, data, isOperator },
      selectedOption,
      selectedStrategy,
    },
    dispatch,
  } = useGlobalContext();

  // Dispatcher for closing modals on escape key press.
  useEffect(() => {
    const handleEscapeKeyPressed = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        dispatch({
          type: ActionType.RESET_OPTIONS_CHAIN_STATE,
        });
      }
    };

    if (optionChainModalOpen) {
      window.addEventListener("keydown", handleEscapeKeyPressed);
    }

    return () => {
      window.removeEventListener("keydown", handleEscapeKeyPressed);
    };
  }, [optionChainModalOpen]);

  // Dispatcher for opening modals.
  useEffect(() => {
    if (activeExpiry && data[activeExpiry]) {
      switch (true) {
        case Boolean(adjustingOption):
          dispatch({
            type: ActionType.SET_OPTION_CHAIN_MODAL_VISIBLE,
            visible: OptionChainModalActions.ADJUST_COLLATERAL,
          });
          break;

        case closingOption && closingOption.isSpread:
          dispatch({
            type: ActionType.SET_OPTION_CHAIN_MODAL_VISIBLE,
            visible: OptionChainModalActions.CLOSE_SPREAD,
          });
          break;

        case closingOption && !closingOption.isShort:
          dispatch({
            type: ActionType.SET_OPTION_CHAIN_MODAL_VISIBLE,
            visible: OptionChainModalActions.CLOSE_LONG,
          });
          break;

        case closingOption && closingOption.isShort:
          dispatch({
            type: ActionType.SET_OPTION_CHAIN_MODAL_VISIBLE,
            visible: OptionChainModalActions.CLOSE_SHORT,
          });
          break;

        case selectedOption?.buyOrSell === "sell" && !isOperator:
        case selectedStrategy?.buyOrSell === "sell" && !isOperator:
          dispatch({
            type: ActionType.SET_OPTION_CHAIN_MODAL_VISIBLE,
            visible: OptionChainModalActions.OPERATOR,
          });
          break;

        case selectedOption?.buyOrSell === "buy":
          dispatch({
            type: ActionType.SET_OPTION_CHAIN_MODAL_VISIBLE,
            visible: OptionChainModalActions.BUY,
          });
          break;

        case selectedOption?.buyOrSell === "sell":
          dispatch({
            type: ActionType.SET_OPTION_CHAIN_MODAL_VISIBLE,
            visible: OptionChainModalActions.SELL,
          });
          break;

        case Boolean(selectedStrategy?.strategy):
          dispatch({
            type: ActionType.SET_OPTION_CHAIN_MODAL_VISIBLE,
            visible: selectedStrategy?.strategy,
          });
          break;

        default:
          break;
      }

      return;
    }
  }, [
    activeExpiry,
    adjustingOption,
    closingOption,
    isOperator,
    selectedOption,
    optionChainModalOpen,
    selectedStrategy,
  ]);

  return [optionChainModalOpen] as const;
};
