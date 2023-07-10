import { useEffect } from "react";
import { useAccount } from "wagmi";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { buildInactivePositions } from "../utils/buildInactivePositions";

export const useUserPositions = () => {
  const { isDisconnected } = useAccount();

  const {
    dispatch,
    state: {
      options: { userPositions, wethOracleHashMap },
    },
  } = useGlobalContext();

  useEffect(() => {
    const inactivePositions = buildInactivePositions(
      userPositions,
      wethOracleHashMap
    );

    dispatch({ type: ActionType.SET_USER_STATS, inactivePositions });
  }, [isDisconnected, userPositions]);
};
