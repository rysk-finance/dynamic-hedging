import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { useGlobalContext } from "src/state/GlobalContext";

import {
  ActionType,
  OptionChainModalActions,
  DashboardModalActions,
} from "src/state/types";

/**
 * Hook that checks query params and state to determine if
 * the modal should be visible.
 *
 * The buy modal is keyed from the `selectedOption` state variable.
 *
 * The close long position modal is keyed from query params.
 *
 * Returns a boolean value for the modal state.
 *
 * @returns readonly [OptionChainModalActions | undefined]
 */
export const useModal = () => {
  const [searchParams] = useSearchParams();

  const {
    state: {
      adjustingOption,
      closingOption,
      dashboardModalOpen,
      optionChainModalOpen,
      options: { activeExpiry, isOperator },
      selectedOption,
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
    if (activeExpiry) {
      if (adjustingOption) {
        dispatch({
          type: ActionType.SET_OPTION_CHAIN_MODAL_VISIBLE,
          visible: OptionChainModalActions.ADJUST_COLLATERAL,
        });
      } else if (closingOption && !closingOption.isShort) {
        dispatch({
          type: ActionType.SET_OPTION_CHAIN_MODAL_VISIBLE,
          visible: OptionChainModalActions.CLOSE,
        });
      } else if (closingOption && closingOption.isShort) {
        dispatch({
          type: ActionType.SET_OPTION_CHAIN_MODAL_VISIBLE,
          visible: OptionChainModalActions.CLOSE_SHORT,
        });
      } else if (selectedOption?.buyOrSell === "buy") {
        dispatch({
          type: ActionType.SET_OPTION_CHAIN_MODAL_VISIBLE,
          visible: OptionChainModalActions.BUY,
        });
      } else if (selectedOption?.buyOrSell === "sell" && !isOperator) {
        dispatch({
          type: ActionType.SET_OPTION_CHAIN_MODAL_VISIBLE,
          visible: OptionChainModalActions.OPERATOR,
        });
      } else if (selectedOption?.buyOrSell === "sell" && isOperator) {
        dispatch({
          type: ActionType.SET_OPTION_CHAIN_MODAL_VISIBLE,
          visible: OptionChainModalActions.SELL,
        });
      }
      return;
    }

    if (searchParams.get("ref") === "adjust-collateral") {
      dispatch({
        type: ActionType.SET_DASHBOARD_MODAL_VISIBLE,
        visible: DashboardModalActions.ADJUST_COLLATERAL,
      });
    }
  }, [
    activeExpiry,
    adjustingOption,
    closingOption,
    isOperator,
    searchParams,
    selectedOption,
  ]);

  return [optionChainModalOpen, dashboardModalOpen] as const;
};
