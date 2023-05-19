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
import { Button } from "src/components/shared/Button";
import { OpynActionType } from "src/enums/OpynActionType";
import { useGraphPolling } from "src/hooks/useGraphPolling";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import {
  fromOpyn,
  fromRysk,
  fromUSDC,
  fromWei,
  toRysk,
} from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { BIG_NUMBER_DECIMALS, ZERO_ADDRESS } from "../../../config/constants";
import { useExpiryPriceData } from "../../../hooks/useExpiryPriceData";
import { getLiquidationPrice } from "../../optionsTrading/Modals/Shared/utils/getLiquidationPrice";
import { getQuote } from "../../optionsTrading/Modals/Shared/utils/getQuote";

/**
 * Hook using GraphQL to fetch all positions for the user
 * and sort them into consumable data. Also places the
 * users positions into global context state.
 *
 * @returns [ loading, error ]
 */
const usePositions = () => {
  const { address, isDisconnected } = useAccount();

  const { allOracleAssets } = useExpiryPriceData();

  // Global state.
  const {
    dispatch,
    state: {
      ethPrice,
      options: { data: chainData, spotShock, timesToExpiry },
    },
  } = useGlobalContext();

  const [hookLoading, setHookLoading] = useState(false);

  // NOTE: Only getting positions opened after redeploy of contracts
  const { error, data, startPolling } = useQuery<{
    longPositions: LongPosition[];
    shortPositions: ShortPosition[];
    vaults: {
      vaultId: string;
      collateralAmount: string;
      shortOToken: {
        id: string;
        symbol: string;
      };
      collateralAsset: {
        name: string;
      };
    }[];
  }>(
    gql`
      query ${QueriesEnum.DASHBOARD_USER_POSITIONS} ($account: String) {
          longPositions(first: 1000, where: { account: $account, oToken_: {expiryTimestamp_gte: "1683273600"} }) {
              id
              netAmount
              buyAmount
              sellAmount
              active
              realizedPnl
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
              redeemActions {
                  id
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
          shortPositions(first: 1000, where: { account: $account, oToken_: {expiryTimestamp_gte: "1683273600"} }) {
              id
              netAmount
              buyAmount
              sellAmount
              active
              realizedPnl
              vault {
                  vaultId
                  collateralAmount
                  collateralAsset {
                      name
                  }
              }
              settleActions {
                  id
              }
              liquidateActions {
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
          vaults(first: 1000, where: { owner: $account, shortOToken_: {id_not: null} }) {
              vaultId
              collateralAmount
              collateralAsset {
                name
              }
              shortOToken {
                  id
                  symbol
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
      dispatch({
        type: ActionType.SET_DASHBOARD,
        activePositions: [],
        inactivePositions: [],
      });
    }

    const constructPositionsData = async () => {
      if (Object.keys(chainData).length && data && allOracleAssets) {
        setHookLoading(true);

        const timeNow = dayjs().unix();

        const parsedActivePositions = [] as ParsedPosition[];
        const parsedInactivePositions = [] as ParsedPosition[];

        for (const {
          id,
          oToken,
          netAmount,
          optionsSoldTransactions,
          optionsBoughtTransactions,
          buyAmount,
          sellAmount,
          active,
          realizedPnl,
          ...rest
        } of [...data.shortPositions, ...data.longPositions]) {
          const {
            id: otokenId,
            expiryTimestamp,
            underlyingAsset,
            isPut,
            strikePrice,
          } = oToken;

          const humanisedStrikePrice = Number(fromOpyn(strikePrice));
          const putOrCall = isPut ? "put" : "call";

          const vault = (rest as ShortPosition)?.vault || { vaultId: "" };
          const settleActions = (rest as ShortPosition)?.settleActions || [];
          const redeemActions = (rest as LongPosition)?.redeemActions || [];
          const liquidateActions =
            (rest as ShortPosition)?.liquidateActions || [];

          const expired = timeNow > Number(expiryTimestamp);

          // Check state to see if the series is disabled.
          const seriesData =
            chainData[expiryTimestamp]?.[humanisedStrikePrice][putOrCall];
          const buyDisabled = seriesData
            ? seriesData.buy.disabled || !seriesData.buy.quote.quote
            : true;
          const sellDisabled = seriesData
            ? seriesData.sell.disabled || !seriesData.sell.quote.quote
            : true;

          const options = vault.vaultId
            ? optionsSoldTransactions
            : optionsBoughtTransactions;

          // 1e18 - TODO: does not account for sales
          const totPremium = options.length
            ? options.reduce(
                (p: number, { premium }: { premium: BigNumberish }) =>
                  vault.vaultId ? p + Number(premium) : p - Number(premium),
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

          const getStatusMessage = (short: boolean) => {
            if (short) {
              switch (true) {
                case liquidatedShort:
                  return "Liquidated";
                case settledShort:
                  return "Settled";
                case !active:
                  return "Closed";
                case buyDisabled:
                  return "Currently Untradeable";
                case !expired:
                  return (
                    <Link
                      to={`/options?expiry=${expiryTimestamp}&token=${otokenId}&ref=vault-close`}
                    >
                      <Button
                        color="white"
                        className="min-w-[50%]"
                        title="Click to close position"
                      >
                        {`Close`}
                      </Button>
                    </Link>
                  );
                default:
                  return "Expired";
              }
            } else {
              switch (true) {
                case hasRedeemed:
                  return "Redeemed";
                case !active:
                  return "Closed";
                case sellDisabled:
                  return "Currently Untradeable";
                case !expired:
                  return (
                    <Link
                      to={`/options?expiry=${expiryTimestamp}&token=${otokenId}&ref=close`}
                    >
                      <Button
                        color="white"
                        className="min-w-[50%]"
                        title="Click to close position"
                      >
                        {`Close`}
                      </Button>
                    </Link>
                  );
                default:
                  return "Expired";
              }
            }
          };

          const amount = Math.abs(
            BigNumber.from(netAmount)
              .div(BIG_NUMBER_DECIMALS.RYSK.div(BIG_NUMBER_DECIMALS.OPYN))
              .toNumber()
          );

          const isRedeemable =
            amount != 0 &&
            expired &&
            Boolean(!vault.vaultId) &&
            redeemActions.length === 0;
          const hasRedeemed = redeemActions.length > 0; // NOTE: User could have manually not redeem all
          const canSettleShort =
            amount != 0 &&
            expired &&
            Boolean(vault.vaultId) &&
            settleActions.length === 0;
          const settledShort = settleActions.length > 0;
          const liquidatedShort = liquidateActions.length > 0;

          const anyExpiredAction =
            isRedeemable || canSettleShort || settledShort || hasRedeemed;

          const collateralAssetSymbol =
            vault.collateralAsset?.name === "USDC" ? "USDC" : "WETH";

          const collateralAllVaults = data.vaults
            .filter(({ shortOToken }) => shortOToken.id === otokenId)
            .reduce((acc, { collateralAmount, collateralAsset }) => {
              return acc.add(collateralAmount);
            }, BigNumber.from(0));

          const getVaultLiquidationPrice = async () => {
            if (ethPrice) {
              const liquidationPrice = await getLiquidationPrice(
                Number(fromOpyn(amount)),
                putOrCall,
                Number(
                  vault.collateralAsset?.name === "USDC"
                    ? fromUSDC(collateralAllVaults)
                    : fromWei(collateralAllVaults)
                ),
                getContractAddress(collateralAssetSymbol) as HexString,
                ethPrice,
                Number(expiryTimestamp),
                spotShock,
                humanisedStrikePrice,
                timesToExpiry
              );
              return liquidationPrice;
            }
            return 0;
          };

          const liquidationPrice =
            amount && Boolean(vault.vaultId)
              ? await getVaultLiquidationPrice()
              : 0;

          // pnl
          const graphPnl = fromUSDC(realizedPnl);
          const { acceptablePremium, fee } =
            amount !== 0 && !anyExpiredAction
              ? await getQuote(
                  Number(expiryTimestamp),
                  toRysk(fromOpyn(strikePrice)),
                  isPut,
                  Number(fromOpyn(amount)),
                  vault.vaultId ? false : true,
                  collateralAssetSymbol
                )
              : {
                  acceptablePremium: 0,
                  fee: 0,
                };

          const diff =
            anyExpiredAction && isPut
              ? Number(fromOpyn(strikePrice)) -
                Number(fromOpyn(expiryPrice || 0))
              : Number(fromOpyn(expiryPrice || 0)) -
                Number(fromOpyn(strikePrice));
          const expectedPayout =
            diff > 0 ? diff * Number(fromWei(netAmount)) : 0;

          const position = {
            ...oToken,
            amount,
            entryPrice,
            expired,
            expiryPrice,
            liquidationPrice,
            id,
            isRedeemable,
            vaultId: vault.vaultId,
            collateralAsset: vault.vaultId ? vault.collateralAsset?.name : "",
            collateralAmount: vault.vaultId
              ? collateralAllVaults.toString()
              : "",
            isSettleable: vault.vaultId ? canSettleShort : false,
            otokenId,
            side: vault.vaultId ? "SHORT" : "LONG",
            status: getStatusMessage(!!vault.vaultId),
            totalPremium: totPremium,
            pnl:
              amount === 0
                ? Number(graphPnl) // if closed position just use graph data
                : vault.vaultId // short pnl is opposite of long as totPremium represents the earnings
                ? Number(graphPnl) -
                  (expectedPayout
                    ? expectedPayout
                    : Number(fromUSDC(acceptablePremium)) - fee)
                : Number(graphPnl) +
                  (expectedPayout
                    ? expectedPayout
                    : Number(fromUSDC(acceptablePremium)) - fee),
            underlyingAsset: underlyingAsset.id,
          };

          if (position.amount !== 0) {
            parsedActivePositions.push(position);
          } else {
            parsedInactivePositions.push(position);
          }
        }

        // Active options sorted closest to furtherest by expiry time.
        // Options with the same expiry date are sorted highest to lowest strike price.
        parsedActivePositions.sort((a, b) => {
          return (
            a.expiryTimestamp.localeCompare(b.expiryTimestamp) ||
            a.strikePrice.localeCompare(b.strikePrice)
          );
        });

        // Inactive options sorted furtherest to closest by expiry time.
        // Options with the same expiry date are sorted highest to lowest strike price.
        parsedInactivePositions.sort((a, b) => {
          return (
            b.expiryTimestamp.localeCompare(a.expiryTimestamp) ||
            b.strikePrice.localeCompare(a.strikePrice)
          );
        });

        dispatch({
          type: ActionType.SET_DASHBOARD,
          activePositions: parsedActivePositions,
          inactivePositions: parsedInactivePositions,
        });

        setHookLoading(false);
      }
    };

    constructPositionsData();
  }, [chainData, data, allOracleAssets, isDisconnected, ethPrice]);

  return [hookLoading, error] as const;
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
