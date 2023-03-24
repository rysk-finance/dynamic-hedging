import type { InitialDataQuery } from "./types";

import { gql, useQuery } from "@apollo/client";
import { captureException } from "@sentry/react";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { QueriesEnum } from "src/clients/Apollo/Queries";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { useUpdateEthPrice } from "../useUpdateEthPrice";
import { getInitialData } from "./utils";

/**
 * Initialiser hook to pre-fetch:
 * - Ether price data.
 * - Options chain data.
 * - User position data if a wallet is connected.
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
    },
    dispatch,
  } = useGlobalContext();

  const { updatePriceData } = useUpdateEthPrice();

  const { data, error, loading } = useQuery<InitialDataQuery>(
    gql`
      query ${QueriesEnum.INITIAL_DATA} ($address: String, $now: String) {
        expiries(
          where: { timestamp_gte: $now }
        ) {
          timestamp
        }

        positions(
          where: { account: $address, amount_not: "0", active: true }
        ) {
          amount
          oToken {
            createdAt
            expiryTimestamp
            id
            isPut
            strikePrice
            symbol
          }
          optionsBoughtTransactions {
            amount
            fee
            premium
          }
        }
      }
    `,
    {
      onError: captureException,
      skip: skip,
      variables: {
        address: address?.toLowerCase(),
        now: String(dayjs().unix()),
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

      getInitialData(data).then(([validExpiries, userPositions, chainData]) => {
        dispatch({
          type: ActionType.SET_OPTIONS,
          activeExpiry: activeExpiry || validExpiries[0],
          data: chainData,
          error,
          expiries: validExpiries,
          loading,
          refresh,
          userPositions,
        });
      });

      setSkip(true);
    }
  }, [data, error, loading, skip]);

  return null;
};
