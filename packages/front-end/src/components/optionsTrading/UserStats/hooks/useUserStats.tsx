import { useEffect } from "react";
import { useAccount } from "wagmi";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

import { getQuotes } from "src/components/shared/utils/getQuote";
import { EMPTY_POSITION } from "src/state/constants";
import { fromOpyn, fromWeiToInt, toRysk } from "src/utils/conversion-helper";
import { buildActivePositions } from "../utils/buildActivePositions";
import { calculateDelta } from "../utils/calculateDelta";
import { calculatePnL } from "../utils/calculatePnL";
import { getTokenLists } from "../utils/getTokenLists";

export const useUserStats = () => {
  const { isDisconnected } = useAccount();

  const {
    dispatch,
    state: {
      ethPrice,
      options: {
        data,
        spotShock,
        timesToExpiry,
        userPositions,
        wethOracleHashMap,
      },
    },
  } = useGlobalContext();

  useEffect(() => {
    const calculate = async () => {
      const [active, longs, shorts] = getTokenLists(userPositions);

      const activeQuotes = await getQuotes(
        active.map(
          ({
            collateralAsset,
            expiryTimestamp,
            isPut,
            netAmount,
            strikePrice,
          }) => {
            const isShort = collateralAsset && "symbol" in collateralAsset;

            return {
              expiry: parseInt(expiryTimestamp),
              strike: toRysk(fromOpyn(strikePrice)),
              isPut: isPut,
              orderSize: Math.abs(fromWeiToInt(netAmount)),
              isSell: !isShort,
              collateral: isShort ? collateralAsset.symbol : "USDC",
            };
          }
        )
      );

      const activePositions = await buildActivePositions(
        data,
        active,
        activeQuotes,
        ethPrice,
        spotShock,
        timesToExpiry,
        wethOracleHashMap
      );

      const [historicalPnL, activePnL] = await calculatePnL(
        ethPrice,
        active,
        longs,
        shorts,
        activeQuotes,
        wethOracleHashMap
      );

      const delta = calculateDelta(data, active);

      return { activePnL, activePositions, delta, historicalPnL };
    };

    dispatch({ type: ActionType.SET_USER_STATS, loading: true });

    if (isDisconnected) {
      dispatch({
        type: ActionType.SET_USER_STATS,
        activePnL: 0,
        activePositions: [EMPTY_POSITION],
        delta: 0,
        historicalPnL: 0,
      });
    } else if (
      Object.values(data).length &&
      Object.values(userPositions).length
    ) {
      calculate().then((values) =>
        dispatch({ type: ActionType.SET_USER_STATS, ...values })
      );
    }

    dispatch({ type: ActionType.SET_USER_STATS, loading: false });
  }, [isDisconnected, userPositions]);
};
