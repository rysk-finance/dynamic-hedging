import { useEffect } from "react";
import { useAccount } from "wagmi";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

import { getTokenLists } from "../utils/getTokenLists";
import { calculateDelta } from "../utils/calculateDelta";
import { calculatePnL } from "../utils/calculatePnL";

export const useUserStats = () => {
  const { isDisconnected } = useAccount();

  const {
    dispatch,
    state: {
      ethPrice,
      options: { data, userPositions, wethOracleHashMap },
    },
  } = useGlobalContext();

  useEffect(() => {
    const calculate = async () => {
      const [activePositions, longPositions, shortPositions] =
        getTokenLists(userPositions);

      const allTimePnL = await calculatePnL(
        ethPrice || 0,
        longPositions,
        shortPositions,
        wethOracleHashMap
      );
      const delta = calculateDelta(data, activePositions);

      return { allTimePnL, delta };
    };

    if (isDisconnected) {
      dispatch({
        type: ActionType.SET_USER_STATS,
        allTimePnL: 0,
        delta: 0,
      });
    } else if (Object.values(userPositions).length) {
      calculate().then((values) =>
        dispatch({ type: ActionType.SET_USER_STATS, ...values })
      );
    }
  }, [isDisconnected, userPositions]);
};