import { AnimatePresence } from "framer-motion";
import { useState } from "react";

import FadeInOut from "src/animation/FadeInOut";
import { Button } from "src/components/shared/Button";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

import { Header } from "../Shared/components/Header";
import { Modal } from "../Shared/components/Modal";
import { getButtonProps } from "../Shared/utils/getButtonProps";
import { setOperator } from "../Shared/utils/transactions";
import { useNotifications } from "../Shared/utils/useNotifications";

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
      <Header>{`Sell Position`}</Header>

      <div className="w-3/5 mx-auto py-4">
        <p className="text-center pb-4 leading-6">
          {`It looks like you're new here. Before you can sell an option we'll need you to complete a one-time approval. This allows our exchange to interact with the option contracts on your behalf.`}
        </p>

        <div className="h-12 border-black border-2">
          <AnimatePresence mode="wait">
            <Button
              className="w-full h-full !border-0"
              disabled={transactionPending}
              requiresConnection
              {...FadeInOut()}
              {...getButtonProps(
                "sell",
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
