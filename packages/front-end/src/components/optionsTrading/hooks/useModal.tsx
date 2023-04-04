import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { useGlobalContext } from "src/state/GlobalContext";

import {
  ActionType,
  OptionChainModalActions,
  DashboardModalActions,
} from "src/state/types";
import { BigNumber } from "ethers";

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
      options: { activeExpiry, isOperator, userPositions },
      dashboardModalOpen,
      optionChainModalOpen,
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
      const hasSellRef = searchParams.get("ref") === "close";
      const hasVaultCloseRef = searchParams.get("ref") === "vault-close";
      const hasUserPosition = userPositions[activeExpiry]?.tokens.find(
        ({ id, netAmount }) =>
          id === searchParams.get("token") &&
          (hasVaultCloseRef
            ? BigNumber.from(netAmount).lt(0)
            : BigNumber.from(netAmount).gt(0))
      );

      if (hasSellRef && hasUserPosition) {
        dispatch({
          type: ActionType.SET_OPTION_CHAIN_MODAL_VISIBLE,
          visible: OptionChainModalActions.CLOSE,
        });
      } else if (hasVaultCloseRef && hasUserPosition) {
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
  }, [activeExpiry, isOperator, searchParams, selectedOption]);

  return [optionChainModalOpen, dashboardModalOpen] as const;
};
