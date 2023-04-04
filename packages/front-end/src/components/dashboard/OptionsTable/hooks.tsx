import type { ApolloError } from "@apollo/client";
import type {
  CompleteRedeem,
  CompleteSettle,
  LongPosition,
  ParsedPosition,
  ShortPosition,
} from "./types";

import { gql, useQuery } from "@apollo/client";
import { prepareWriteContract, writeContract } from "@wagmi/core";
import dayjs from "dayjs";
import { BigNumber, BigNumberish } from "ethers";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";

import { NewControllerABI } from "src/abis/NewController_ABI";
import { QueriesEnum } from "src/clients/Apollo/Queries";
import { OpynActionType } from "src/enums/OpynActionType";
import { useGraphPolling } from "src/hooks/useGraphPolling";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { BIG_NUMBER_DECIMALS, ZERO_ADDRESS } from "../../../config/constants";
import { useExpiryPriceData } from "../../../hooks/useExpiryPriceData";
import { fromRysk, fromUSDC } from "../../../utils/conversion-helper";

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
    longPositions: LongPosition[];
    shortPositions: ShortPosition[];
  }>(
    gql`
      query ${QueriesEnum.DASHBOARD_USER_POSITIONS} ($account: String) {
          longPositions(first: 1000, where: { account: $account }) {
              id
              netAmount
              buyAmount
              sellAmount
              active
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
              optionsBoughtTransactions {
                  amount
                  premium
              }
              optionsSoldTransactions {
                  amount
                  premium
              }
          }
          shortPositions(first: 1000, where: { account: $account }) {
              id
              netAmount
              buyAmount
              sellAmount
              active
              vault {
                  vaultId
              }
              settleActions {
                  id
              }
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
              optionsBoughtTransactions {
                  amount
                  premium
              }
              optionsSoldTransactions {
                  amount
                  premium
              }
          }
      }
    `,
    {
      onError: logError,
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

      const parsedPositions = [
        ...data.shortPositions,
        ...data.longPositions,
      ].map(
        ({
          id,
          oToken,
          netAmount,
          optionsSoldTransactions,
          optionsBoughtTransactions,
          buyAmount,
          sellAmount,
          active,
          ...rest
        }) => {
          const {
            id: otokenId,
            expiryTimestamp,
            underlyingAsset,
            isPut,
            strikePrice,
          } = oToken;

          const vault = (rest as ShortPosition)?.vault || { vaultId: "" };
          const settleActions = (rest as ShortPosition)?.settleActions || [];

          const expired = timeNow > Number(expiryTimestamp);

          const options = vault.vaultId
            ? optionsSoldTransactions
            : optionsBoughtTransactions;

          // 1e18 - TODO: does not account for sales
          const totPremium = options.length
            ? options.reduce(
                (p: number, { premium }: { premium: BigNumberish }) =>
                  p - Number(premium),
                0
              )
            : 0;

          // Total premium converted to 1e18 - TODO: does not account for sales
          // const totalPremium = totPremium / 10 ** DECIMALS.RYSK;

          // per token premium converted to 1e18
          // average price to 1e18 - TODO: review before merge
          const entryPrice = (
            Number(fromUSDC(totPremium.toString())) /
            Number(
              fromRysk((vault.vaultId ? sellAmount : buyAmount).toString())
            )
          ).toFixed(2);

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
          const isRedeemable = expired && Boolean(netAmount) && inTheMoney;
          //@todo BUG get this from graph action REDEEM cause if this was traded to another account this would be wrong
          const hasRedeemed = expired && !netAmount && inTheMoney;
          //@todo BUG same as above, let's also get this from the graph (optionsSoldTransactions)
          const hasSoldBack = !netAmount && !hasRedeemed;
          //@todo FEAT just add a boolean prop settledShort to the graph Position entity
          const canSettleShort = settleActions.length == 0 && expired;
          const settledShort = settleActions.length > 0;

          const getStatusMessage = (short: boolean) => {
            if (short) {
              switch (true) {
                case !active:
                  return "Closed";
                case canSettleShort:
                  return "Settle";
                case settledShort:
                  return "Settled";
                case !expired:
                  return (
                    <Link
                      className="p-4"
                      to={`/options?expiry=${expiryTimestamp}&token=${otokenId}&vault=${vault.vaultId}&ref=vault-close`}
                    >
                      {`Close position`}
                    </Link>
                  );
                default:
                  return "Expired";
              }
            } else {
              switch (true) {
                case !active:
                  return "Closed";
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
            }
          };

          return {
            ...oToken,
            amount: BigNumber.from(netAmount)
              .div(BIG_NUMBER_DECIMALS.RYSK.div(BIG_NUMBER_DECIMALS.OPYN))
              .toNumber(),
            entryPrice,
            expired,
            expiryPrice,
            id,
            isRedeemable,
            vaultId: vault.vaultId,
            isSettleable: vault.vaultId ? canSettleShort : false,
            otokenId,
            side: vault.vaultId ? "SHORT" : "LONG",
            status: getStatusMessage(!!vault.vaultId),
            totalPremium: totPremium,
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
 * expired long positions that are redeemable.
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

/**
 * Simple hook to return a settle function for
 * expired short positions that are settleable.
 *
 * @returns [completeSettle]
 */
const useSettle = () => {
  const { address } = useAccount();

  const completeSettle = useCallback(
    async (vaultId: string) => {
      const args = [
        {
          actionType: OpynActionType.SettleVault,
          owner: address as HexString,
          secondAddress: address as HexString,
          asset: ZERO_ADDRESS as HexString,
          vaultId: BigNumber.from(vaultId),
          amount: BigNumber.from(0),
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
    [OpynActionType.SettleVault, address]
  );

  return [completeSettle] as [CompleteSettle];
};

export { usePositions, useRedeem, useSettle };
