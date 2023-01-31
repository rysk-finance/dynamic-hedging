import type { ApolloError } from "@apollo/client";
import type { CompleteRedeem, ParsedPosition, Position } from "./types";

import { gql, useQuery } from "@apollo/client";
import { captureException } from "@sentry/react";
import dayjs from "dayjs";
import { BigNumber } from "ethers";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";

import OpynActionType from "src/enums/OpynActionType";
import OpynController from "../../../abis/OpynController.json";
import { DECIMALS, ZERO_ADDRESS } from "../../../config/constants";
import { useContract } from "../../../hooks/useContract";
import { useExpiryPriceData } from "../../../hooks/useExpiryPriceData";

/**
 * Hook using GraphQL to fetch all positions for the user
 * and sort them into consumable data.
 *
 * @returns [positions, loading, error]
 */
const usePositions = () => {
  const { address, isDisconnected } = useAccount();

  const { allOracleAssets } = useExpiryPriceData();
  const [positions, setPositions] = useState<ParsedPosition[] | null>(null);

  const { loading, error, data } = useQuery<{ positions: Position[] }>(
    gql`
      query ($account: String) {
        positions(first: 1000, where: { account: $account }) {
          id
          oToken {
            id
            symbol
            expiryTimestamp
            strikePrice
            isPut
            underlyingAsset {
              id
            }
          }
          writeOptionsTransactions {
            premium
          }
          account {
            balances {
              balance
              token {
                id
              }
            }
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
        account: address?.toLowerCase(),
      },
      skip: !address,
    }
  );

  useEffect(() => {
    if (isDisconnected) {
      return setPositions([]);
    }

    if (data && allOracleAssets) {
      const timeNow = dayjs().unix();

      const parsedPositions = data.positions.map(
        ({ id, oToken, account, writeOptionsTransactions }) => {
          const {
            id: otokenId,
            expiryTimestamp,
            underlyingAsset,
            isPut,
            strikePrice,
          } = oToken;

          const expired = timeNow > Number(expiryTimestamp);

          // Check for oToken balance.
          const matchingToken = account.balances.filter(
            ({ token }) => token.id === otokenId
          )[0];
          const otokenBalance =
            matchingToken && matchingToken.balance
              ? Number(matchingToken.balance)
              : 0;

          // 1e8
          const totPremium = writeOptionsTransactions.length
            ? writeOptionsTransactions.reduce(
                (prev: number, { premium }: { premium: BigNumber }) =>
                  prev + Number(premium),
                0
              )
            : 0;

          // premium converted to 1e18
          const entryPrice =
            otokenBalance > 0 && totPremium > 0
              ? Number(
                  totPremium /
                    (otokenBalance * 10 ** (DECIMALS.RYSK - DECIMALS.OPYN))
                ).toFixed(2)
              : "0.00";

          // Find expiry price
          const asset = allOracleAssets.find(
            ({ asset }) => asset.id === underlyingAsset.id
          );
          const expiryPrice = asset?.prices.find(
            ({ expiry }: { expiry: string }) => expiry === expiryTimestamp
          )?.price;

          // Determine action
          const inTheMoney = isPut
            ? Number(expiryPrice) <= Number(strikePrice)
            : Number(expiryPrice) >= Number(strikePrice);
          const isRedeemable = expired && Boolean(otokenBalance) && inTheMoney;
          const hasRedeemed = expired && !otokenBalance && inTheMoney;
          const hasSoldBack = !otokenBalance && !hasRedeemed;

          const getStatusMessage = () => {
            switch (true) {
              case hasRedeemed:
                return "Redeemed";

              case hasSoldBack:
                return "Closed";

              case !expired:
                return "Contact team to close";

              default:
                return "Expired";
            }
          };

          return {
            ...oToken,
            id,
            expired,
            amount: otokenBalance,
            entryPrice,
            underlyingAsset: underlyingAsset.id,
            side: "LONG",
            expiryPrice,
            isRedeemable,
            otokenId,
            status: getStatusMessage(),
          };
        }
      );

      // Unexpired options sorted closest to furtherest by expiry time.
      // Expired options sorted most recent to oldest.
      // Options with the same expiry date are sorted highest to lowest strike price.
      parsedPositions.sort((a, b) => {
        if (!a.expired && !b.expired) {
          return (
            a.expiryTimestamp.localeCompare(b.expiryTimestamp) ||
            a.strikePrice.localeCompare(b.strikePrice)
          );
        }

        return (
          b.expiryTimestamp.localeCompare(a.expiryTimestamp) ||
          b.strikePrice.localeCompare(a.strikePrice)
        );
      });

      setPositions(parsedPositions);
    }
  }, [data, allOracleAssets, isDisconnected]);

  return [positions, loading, error] as [
    ParsedPosition[] | null,
    boolean,
    ApolloError | undefined
  ];
};

/**
 * Simple hook to return a redeem function for
 * expired positions that are redeemable.
 *
 * @returns [completeRedeem]
 */
const useRedeem = () => {
  const { address } = useAccount();

  const [opynControllerContract, opynControllerContractCall] = useContract({
    contract: "OpynController",
    ABI: OpynController,
    readOnly: false,
  });

  const completeRedeem = useCallback(
    async (otokenId: string, amount: number) => {
      const args = {
        actionType: OpynActionType.Redeem,
        owner: ZERO_ADDRESS,
        secondAddress: address,
        asset: otokenId,
        vaultId: "0",
        amount,
        index: "0",
        data: ZERO_ADDRESS,
      };

      await opynControllerContractCall({
        method: opynControllerContract?.operate,
        args: [[args]],
        completeMessage: "✅ Order complete",
      });
    },
    [
      OpynActionType.Redeem,
      address,
      opynControllerContract,
      opynControllerContractCall,
    ]
  );

  return [completeRedeem] as [CompleteRedeem];
};

export { usePositions, useRedeem };
