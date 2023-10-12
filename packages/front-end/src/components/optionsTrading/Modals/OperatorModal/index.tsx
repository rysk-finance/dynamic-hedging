import { AnimatePresence } from "framer-motion";
import { useState } from "react";

import FadeInOutQuick from "src/animation/FadeInOutQuick";
import { Button } from "src/components/shared/Button";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

import { setOperator } from "src/components/shared/utils/transactions/setOperator";
import { useNotifications } from "../../hooks/useNotifications";
import { Header } from "../Shared/components/Header";
import { Modal } from "../Shared/components/Modal";
import { getButtonProps } from "../Shared/utils/getButtonProps";

export const OperatorModal = () => {
  const {
    state: {
      options: { isOperator, loading, refresh },
    },
    dispatch,
  } = useGlobalContext();

  const [, handleTransactionSuccess, notifyFailure] = useNotifications();

  const [transactionPending, setTransactionPending] = useState(false);

  const handleOperatorApproval = async () => {
    setTransactionPending(true);

    try {
      const hash = await setOperator(isOperator);

      if (hash) {
        dispatch({ type: ActionType.SET_OPTIONS, isOperator: !isOperator });
        setTransactionPending(false);
        handleTransactionSuccess(hash, "Operator approval");
        refresh();
      }
    } catch (error) {
      setTransactionPending(false);
      notifyFailure(error);
    }
  };

  return (
    <Modal>
      <Header>{`Set Operator`}</Header>

      <div className="w-4/5 xl:w-3/5 mx-auto py-3">
        <p className="text-center pb-3 leading-6">
          {`It looks like you're new here. Before you can sell an option we'll need you to complete a one-time approval. This allows our exchange to interact with the option contracts on your behalf.`}
        </p>

        <div className="h-12 border-black border-2">
          <AnimatePresence mode="wait">
            <Button
              className="w-full h-full !border-0"
              disabled={transactionPending}
              requiresConnection
              {...FadeInOutQuick}
              {...getButtonProps(
                "set",
                transactionPending || loading,
                isOperator,
                handleOperatorApproval
              )}
            />
          </AnimatePresence>
        </div>
      </div>
    </Modal>
  );
};
