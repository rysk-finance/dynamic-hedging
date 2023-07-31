import { useAddRecentTransaction } from "@rainbow-me/rainbowkit";
import { useCallback } from "react";
import { toast } from "react-toastify";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { logError } from "src/utils/logError";
import { parseError } from "src/utils/parseRPCError";

export const useNotifications = () => {
  const addRecentTransaction = useAddRecentTransaction();

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
    },
    [addRecentTransaction, dispatch]
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
      toast(parseError(error));
    }
  }, []);

  return [
    notifyApprovalSuccess,
    handleTransactionSuccess,
    notifyFailure,
  ] as const;
};
