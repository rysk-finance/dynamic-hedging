import { useChainModal } from "@rainbow-me/rainbowkit";
import { useCallback, useMemo } from "react";
import { useAccount, useNetwork } from "wagmi";

import { Handshake } from "src/Icons";
import { useNotifications } from "src/components/optionsTrading/hooks/useNotifications";
import { bulkExercise } from "src/components/shared/utils/transactions/bulkExercise";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { PositionAction } from "../../../enums";

const relevantActions = [
  PositionAction.BURN,
  PositionAction.REDEEM,
  PositionAction.SETTLE,
];

export const ExpiredButton = () => {
  const {
    dispatch,
    state: {
      options: { refresh },
      userStats: { activePositions },
    },
  } = useGlobalContext();

  const { address } = useAccount();
  const { chain } = useNetwork();
  const { openChainModal } = useChainModal();

  const [, handleTransactionSuccess, notifyFailure] = useNotifications();

  const exercisable = useMemo(
    () =>
      activePositions.filter(({ action }) => relevantActions.includes(action)),
    [activePositions]
  );

  const isDisabled = !exercisable.length;

  const handleClick = useCallback(async () => {
    if (openChainModal && chain?.unsupported) return openChainModal();

    try {
      dispatch({ type: ActionType.SET_USER_STATS, loading: true });

      const hash = await bulkExercise(
        exercisable,
        refresh,
        address as HexString
      );

      if (hash) {
        handleTransactionSuccess(hash, "Bulk exercise");
      }
    } catch (error) {
      dispatch({ type: ActionType.SET_USER_STATS, loading: false });
      notifyFailure(error);
    }
  }, [address, chain, exercisable]);

  return (
    <button
      className="mr-auto py-1.5"
      disabled={isDisabled}
      onClick={handleClick}
    >
      <span
        className={`flex border-black border rounded-lg py-1 px-3 ease-in-out duration-200 ${
          isDisabled ? "opacity-40" : ""
        }`}
      >
        <small className="leading-6 mr-2">{`Bulk exercise expired`}</small>
        <Handshake />
      </span>
    </button>
  );
};
