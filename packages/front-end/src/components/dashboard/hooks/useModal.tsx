import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { useGlobalContext } from "src/state/GlobalContext";

import { ActionType, DashboardModalActions } from "src/state/types";

/**
 * Hook that checks query params and state to determine if
 * the modal should be visible.
 *
 * The update collateral modal is keyed from query params.
 *
 * Returns a boolean value for the modal state.
 *
 * @returns readonly [DashboardModalActions | undefined]
 */
export const useModal = () => {
  const [searchParams] = useSearchParams();

  const {
    state: { dashboardModalOpen },
    dispatch,
  } = useGlobalContext();

  // Dispatcher for closing modals on escape key press.
  useEffect(() => {
    const handleEscapeKeyPressed = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        dispatch({
          type: ActionType.SET_DASHBOARD_MODAL_VISIBLE,
        });
      }
    };

    if (dashboardModalOpen) {
      window.addEventListener("keydown", handleEscapeKeyPressed);
    }

    return () => {
      window.removeEventListener("keydown", handleEscapeKeyPressed);
    };
  }, [dashboardModalOpen]);

  // Dispatcher for opening modals.
  useEffect(() => {
    if (searchParams.get("ref") === "adjust-collateral") {
      dispatch({
        type: ActionType.SET_DASHBOARD_MODAL_VISIBLE,
        visible: DashboardModalActions.ADJUST_COLLATERAL,
      });
    }
  }, [searchParams]);

  return [dashboardModalOpen] as const;
};
