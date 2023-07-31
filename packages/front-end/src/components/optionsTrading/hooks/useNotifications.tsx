import { useAddRecentTransaction } from "@rainbow-me/rainbowkit";
import { useCallback } from "react";
import { toast } from "react-toastify";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { errorToast } from "src/utils/parseRPCError";

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

  return [notifyApprovalSuccess, handleTransactionSuccess, errorToast] as const;
};
