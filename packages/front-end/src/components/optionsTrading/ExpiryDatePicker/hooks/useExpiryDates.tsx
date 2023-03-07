import type { BigNumber } from "ethers";

import type {
  ExpiryDateList,
  UserExpiryStatus,
  UserPositions,
  VisibleRange,
} from "../types";

import { gql, useQuery } from "@apollo/client";
import { captureException } from "@sentry/react";
import { readContract } from "@wagmi/core";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAccount } from "wagmi";

import { OptionCatalogueABI } from "src/abis/OptionCatalogue_ABI";
import { QueriesEnum } from "src/clients/Apollo/Queries";
import { useOptionsTradingContext } from "src/state/OptionsTradingContext";
import { OptionsTradingActionType } from "src/state/types";
import { getContractAddress } from "src/utils/helpers";

/**
 * Hook to fetch all expiry dates from the option catalogue and parse them into a list of unix time stamps.
 * Currently selected expiry date is set into the options trading context.
 * Also queries the graph for the users balances - currently only works for long positions.
 *
 * @property expiryDate - The currently selected unix time stamp.
 * @property expiryDates - A list of all available unix time stamps.
 * @property visibleRange - A tuple representing the visible index range of the expiryDates list.
 * @property handleExpirySelection - Handler function for selecting an option expiry.
 * @property scrollExpiries - A function to move the visible index of expiry dates.
 * @property balances - A dict of the user balances, displaying if they are long/short and their expiry.
 *
 * @returns [number | null, ExpiryDateList, VisibleRange, (date: number) => () => void, (direction: 1 | -1) => () => void]
 */
export const useExpiryDates = () => {
  const { address } = useAccount();
  const [searchParams] = useSearchParams();

  const queryExpiry = Number(searchParams.get("expiry"));

  const {
    state: { expiryDate },
    dispatch,
  } = useOptionsTradingContext();

  const [expiryDates, setExpiryDates] = useState<ExpiryDateList>([]);
  const [visibleRange, setVisibleRange] = useState<VisibleRange>([0, 0]);

  const setExpiryDate = useCallback(
    (date: number | null) => {
      dispatch({ type: OptionsTradingActionType.SET_EXPIRY_DATE, date });
    },
    [dispatch]
  );

  const handleExpirySelection = (date: number) => () => setExpiryDate(date);

  const scrollExpiries = (direction: 1 | -1) => () =>
    setVisibleRange(([currentMin, currentMax]) => [
      currentMin + direction,
      currentMax + direction,
    ]);

  useEffect(() => {
    const fetchExpirations = async () => {
      try {
        const expiries = await readContract({
          address: getContractAddress("optionCatalogue"),
          abi: OptionCatalogueABI,
          functionName: "getExpirations",
        });

        if (expiries) {
          const expiryTimestamps = expiries
            .reduce((expiryDates: ExpiryDateList, expiration: BigNumber) => {
              const now = dayjs().unix();
              const timestamp = expiration.toNumber();

              // Hide any expiries that are in the past or do not end at 8am.
              if (timestamp > now && dayjs.unix(timestamp).utc().hour() === 8) {
                expiryDates.push(timestamp);
              }

              return expiryDates;
            }, [])
            .sort((a, b) => a - b);

          if (queryExpiry && expiryTimestamps.includes(queryExpiry)) {
            const index = expiryTimestamps.indexOf(queryExpiry);

            setExpiryDate(expiryTimestamps[index]);
          } else {
            setExpiryDate(expiryTimestamps[0]);
          }

          setExpiryDates(expiryTimestamps);
          setVisibleRange([0, Math.min(3, expiryTimestamps.length - 1)]);
        }
      } catch (error) {
        console.log(error);
        captureException(error);
      }
    };

    fetchExpirations();
  }, []);

  const { data } = useQuery<UserPositions>(
    gql`
      query ${QueriesEnum.OPTIONS_CHAIN_EXPIRY_DATES} ($address: String) {
        account(id: $address) {
          balances {
            token {
              expiryTimestamp
            }
            balance
          }
        }
      }
    `,
    {
      onError: (err) => {
        captureException(err);
        console.error(err);
      },
      variables: {
        address: address?.toLowerCase(),
      },
      skip: !address,
    }
  );

  const balances: UserExpiryStatus[] | undefined = data?.account?.balances.map(
    ({ balance, token }) => {
      return {
        isLong: Number(balance) > 0,
        isShort: Number(balance) < 0,
        timestamp: Number(token.expiryTimestamp),
      };
    }
  );

  return [
    expiryDate,
    expiryDates,
    visibleRange,
    handleExpirySelection,
    scrollExpiries,
    balances,
  ] as const;
};
