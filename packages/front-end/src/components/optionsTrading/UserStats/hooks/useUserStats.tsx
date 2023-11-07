import { useEffect } from "react";
import { useAccount } from "wagmi";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

import { getQuotes } from "src/components/shared/utils/getQuote";
import { Convert } from "src/utils/Convert";
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
              expiry: Convert.fromStr(expiryTimestamp).toInt(),
              strike: Convert.fromOpyn(strikePrice).toWei(),
              isPut,
              orderSize: Math.abs(Convert.fromWei(netAmount).toInt()),
              isSell: !isShort,
              collateral: isShort ? collateralAsset.symbol : "USDC",
            };
          }
        )
      );

      const activeCollateralQuotes = await getQuotes(
        active.map(({ netAmount, vault }) => {
          const longCollateralToken = vault?.longCollateral?.oToken;

          if (longCollateralToken) {
            const { expiryTimestamp, isPut, strikePrice } = longCollateralToken;

            return {
              expiry: Convert.fromStr(expiryTimestamp).toInt(),
              strike: Convert.fromOpyn(strikePrice).toWei(),
              isPut,
              orderSize: Math.abs(Convert.fromWei(netAmount).toInt()),
              isSell: true,
              collateral: "USDC",
            };
          }

          return {
            expiry: 0,
            strike: Convert.fromInt(0).toWei(),
            isPut: false,
            orderSize: 0,
            isSell: false,
            collateral: "USDC",
          };
        })
      );

      const activePositions = await buildActivePositions(
        data,
        active,
        activeQuotes,
        activeCollateralQuotes,
        ethPrice,
        spotShock,
        timesToExpiry,
        wethOracleHashMap
      );

      const [
        historicalPnLWithFees,
        historicalPnLWithoutFees,
        activePnLWithFees,
        activePnLWithoutFees,
      ] = await calculatePnL(
        ethPrice,
        active,
        longs,
        shorts,
        activeQuotes,
        activeCollateralQuotes,
        wethOracleHashMap
      );

      const delta = calculateDelta(data, active);

      return {
        activePnL: [activePnLWithFees, activePnLWithoutFees] as [
          number,
          number,
        ],
        activePositions,
        delta,
        historicalPnL: [historicalPnLWithFees, historicalPnLWithoutFees] as [
          number,
          number,
        ],
      };
    };

    dispatch({ type: ActionType.SET_USER_STATS, loading: true });

    if (isDisconnected) {
      dispatch({
        type: ActionType.SET_USER_STATS,
        activePnL: [0, 0],
        activePositions: [],
        delta: 0,
        historicalPnL: [0, 0],
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
