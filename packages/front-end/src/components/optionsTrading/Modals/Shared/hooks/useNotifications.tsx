import { useAddRecentTransaction } from "@rainbow-me/rainbowkit";
import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { logError } from "src/utils/logError";

export const useNotifications = () => {
  const addRecentTransaction = useAddRecentTransaction();
  const [, setSearchParams] = useSearchParams();

  const { dispatch } = useGlobalContext();

  const notifyApprovalSuccess = useCallback(
    (hash: HexString) => {
      addRecentTransaction({ hash, description: "Approval" });
      toast("Transaction approved!");
    },
    [addRecentTransaction]
  );

  const handleTransactionSuccess = useCallback(
    (hash: string, description: string) => {
      addRecentTransaction({ hash, description });
      toast(`${description} completed!`);
      dispatch({
        type: ActionType.RESET_OPTIONS_CHAIN_STATE,
      });
      setSearchParams({});
    },
    [addRecentTransaction, dispatch, setSearchParams]
  );

  const notifyFailure = useCallback((error: unknown) => {
    if (
      !(
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "UserRejectedRequestError"
      )
    ) {
      logError(error);
      toast(
        "Sorry, but there was a problem completing your transaction. The team has been informed and we will be looking into it."
      );
    }
  }, []);

  return [
    notifyApprovalSuccess,
    handleTransactionSuccess,
    notifyFailure,
  ] as const;
};
