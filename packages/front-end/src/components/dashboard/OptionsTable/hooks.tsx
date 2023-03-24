import type { ApolloError } from "@apollo/client";
import type { CompleteRedeem, Position, ParsedPosition } from "./types";

import { gql, useQuery } from "@apollo/client";
import { captureException } from "@sentry/react";
import { prepareWriteContract, writeContract } from "@wagmi/core";
import dayjs from "dayjs";
import { BigNumber } from "ethers";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";

import { NewControllerABI } from "src/abis/NewController_ABI";
import { OpynActionType } from "src/enums/OpynActionType";
import { useGraphPolling } from "src/hooks/useGraphPolling";
import { getContractAddress } from "src/utils/helpers";
import { DECIMALS, ZERO_ADDRESS } from "../../../config/constants";
import { useExpiryPriceData } from "../../../hooks/useExpiryPriceData";
import { QueriesEnum } from "src/clients/Apollo/Queries";

/**
 * Hook using GraphQL to fetch all positions for the user
 * and sort them into consumable data. Also places the
 * users positions into global context state.
 *
 * @returns [positions, loading, error]
 */
const usePositions = () => {
  const { address, isDisconnected } = useAccount();

  const { allOracleAssets } = useExpiryPriceData();
  const [positions, setPositions] = useState<ParsedPosition[] | null>(null);

  const { loading, error, data, startPolling } = useQuery<{
    positions: Position[];
  }>(
    gql`
      query ${QueriesEnum.DASHBOARD_USER_POSITIONS} ($account: String) {
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
            createdAt
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

  useGraphPolling(data, startPolling);

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

          // 1e18 - TODO: does not account for sales
          const totPremium = writeOptionsTransactions.length
            ? writeOptionsTransactions.reduce(
                (prev: number, { premium }) => prev + Number(premium),
                0
              )
            : 0;

          // Total premium converted to 1e18 - TODO: does not account for sales
          const totalPremium = totPremium / 10 ** DECIMALS.RYSK;

          // per token premium converted to 1e18
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
                return (
                  <Link
                    className="p-4"
                    to={`/options?expiry=${expiryTimestamp}&token=${otokenId}&ref=close`}
                  >
                    {`Close position`}
                  </Link>
                );

              default:
                return "Expired";
            }
          };

          return {
            ...oToken,
            amount: otokenBalance,
            entryPrice,
            expired,
            expiryPrice,
            id,
            isRedeemable,
            otokenId,
            side: "LONG",
            status: getStatusMessage(),
            totalPremium,
            underlyingAsset: underlyingAsset.id,
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

  const completeRedeem = useCallback(
    async (otokenId: string, amount: number) => {
      const args = [
        {
          actionType: OpynActionType.Redeem,
          owner: ZERO_ADDRESS as HexString,
          secondAddress: address as HexString,
          asset: otokenId as HexString,
          vaultId: BigNumber.from(0),
          amount: BigNumber.from(amount),
          index: BigNumber.from(0),
          data: ZERO_ADDRESS as HexString,
        },
      ];

      const config = await prepareWriteContract({
        address: getContractAddress("OpynController"),
        abi: NewControllerABI,
        functionName: "operate",
        args: [args],
        overrides: {
          gasLimit: BigNumber.from("3000000"),
        },
      });

      await writeContract(config);
    },
    [OpynActionType.Redeem, address]
  );

  return [completeRedeem] as [CompleteRedeem];
};

export { usePositions, useRedeem };
