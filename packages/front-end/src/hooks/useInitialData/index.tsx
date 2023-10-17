import type { InitialDataQuery } from "./types";

import { gql, useQuery } from "@apollo/client";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { useUpdateEthPrice } from "../useUpdateEthPrice";
import { initialDataQuery } from "./graphQuery";
import { getInitialData } from "./utils";
import { Convert } from "src/utils/Convert";

/**
 * Initialiser hook to pre-fetch:
 * - Ether price data include oracle prices.
 * - Options chain data.
 * - User position data if a wallet is connected.
 * - Liquidation calculation parameters.
 * - Liquidity pool info.
 *
 * Also sets the error and loading states, as well as
 * a refresh function into global context state for
 * visibility and re-triggering.
 *
 * @returns void
 */
export const useInitialData = () => {
  const { address } = useAccount();

  const [skip, setSkip] = useState(false);

  const {
    state: {
      options: { activeExpiry },
      selectedOption,
    },
    dispatch,
  } = useGlobalContext();

  const { updatePriceData } = useUpdateEthPrice();

  const { data, error, loading } = useQuery<InitialDataQuery>(
    gql(initialDataQuery),
    {
      fetchPolicy: "cache-and-network",
      onError: logError,
      skip: skip,
      variables: {
        address: address?.toLowerCase(),
        after: process.env.REACT_APP_TRANSACTIONS_AFTER || "0",
        underlying: getContractAddress("WETH"),
      },
    }
  );

  const refresh = () => {
    setSkip(false);
  };

  useEffect(() => {
    if (!loading) refresh();
  }, [address, loading]);

  useEffect(() => {
    if (loading) {
      dispatch({
        type: ActionType.SET_OPTIONS,
        loading,
      });
    }

    if (error && !loading) {
      dispatch({
        type: ActionType.SET_OPTIONS,
        error,
        loading,
      });
    }

    if (data && !loading) {
      updatePriceData();

      getInitialData(data, address).then(
        ([
          validExpiries,
          userPositions,
          chainData,
          isOperator,
          liquidationParameters,
          liquidityPoolInfo,
          oracleHashMap,
        ]) => {
          const firstAvailableExpiry = validExpiries.find(
            (expiry) =>
              Convert.fromStr(expiry).toInt() > dayjs().add(1, "day").unix()
          );

          dispatch({
            type: ActionType.SET_OPTIONS,
            activeExpiry: activeExpiry || firstAvailableExpiry,
            data: chainData,
            error,
            expiries: validExpiries,
            isOperator,
            liquidityPool: liquidityPoolInfo,
            loading,
            refresh,
            spotShock: liquidationParameters.spotShock,
            timesToExpiry: liquidationParameters.timesToExpiry,
            userPositions,
            wethOracleHashMap: oracleHashMap,
          });

          if (activeExpiry && selectedOption) {
            const strike = selectedOption.strikeOptions.strike;
            const newStrikeOptions = chainData[activeExpiry][strike];
            const option = {
              ...selectedOption,
              strikeOptions: newStrikeOptions,
            };

            dispatch({ type: ActionType.SET_SELECTED_OPTION, option });
          }
        }
      );

      setSkip(true);
    }
  }, [data, error, loading, skip]);

  return null;
};
