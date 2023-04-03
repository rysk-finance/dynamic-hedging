import { useAddRecentTransaction } from "@rainbow-me/rainbowkit";
import { captureException } from "@sentry/react";
import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";

import { useOptionsTradingContext } from "src/state/OptionsTradingContext";
import { OptionsTradingActionType } from "src/state/types";

export const useNotifications = () => {
  const addRecentTransaction = useAddRecentTransaction();
  const [, setSearchParams] = useSearchParams();

  const { dispatch } = useOptionsTradingContext();

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
        type: OptionsTradingActionType.RESET,
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
      captureException(error);
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
