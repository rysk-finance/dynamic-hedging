import type { Addresses } from "../../Shared/types";
import type { PositionDataState } from "../types";

import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAccount } from "wagmi";

import { useGlobalContext } from "src/state/GlobalContext";
import {
  fromOpynToNumber,
  fromWeiToInt,
  renameOtoken,
} from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { useAllowance } from "../../Shared/hooks/useAllowance";
import { gql, useQuery } from "@apollo/client";
import { VaultQueryData } from "../../Shared/types";
import { BigNumber } from "ethers";
import { BIG_NUMBER_DECIMALS } from "../../../../../config/constants";

export const useShortPositionData = () => {
  // URL query params.
  const [searchParams] = useSearchParams();

  // Context state.
  const {
    state: {
      options: { activeExpiry, data, userPositions },
    },
  } = useGlobalContext();

  // Addresses.
  const { address } = useAccount();
  const tokenAddress = (searchParams.get("token") as HexString) || undefined;
  const vaultID = searchParams.get("vault") || undefined;
  const exchangeAddress = getContractAddress("optionExchange");

  // User position state.
  const [positionData, setPositionData] = useState<PositionDataState>({
    created: null,
    now: null,
    totalSize: 0,
    totalValue: 0,
    totalPaid: 0,
    inProfit: false,
    title: null,
  });

  const { data: vaultData } = useQuery<VaultQueryData>(
    gql`
      query ($vaultId: ID!) {
        vault(id: $vaultId) {
          id
          collateralAmount
          shortAmount
          collateralAsset {
            id
          }
        }
      }
    `,
    {
      variables: {
        vaultId: `${address?.toLowerCase()}-${vaultID}`,
      },
      skip: !vaultID || !address,
    }
  );

  // At the moment this is either going to be USDC or WETH.
  const collateralAsset = vaultData?.vault?.collateralAsset?.id as HexString;

  // User allowance state for the oToken.
  const [allowance, setAllowance] = useAllowance(collateralAsset, address);

  // Get user position data.
  useEffect(() => {
    if (activeExpiry && tokenAddress && userPositions) {
      const userPosition = userPositions[activeExpiry]?.tokens.find(
        ({ id, netAmount }) =>
          id === searchParams.get("token") && BigNumber.from(netAmount).lt(0)
      );

      if (userPosition) {
        const created = dayjs
          .unix(Number(userPosition.createdAt))
          .format("lll");
        const now = dayjs().format("lll");

        const chainRow =
          data[userPosition.expiryTimestamp][
            fromOpynToNumber(userPosition.strikePrice)
          ];
        const currentValue =
          chainRow[userPosition.isPut ? "put" : "call"].sell.quote.total;

        if (currentValue >= 0) {
          const totalSize = fromWeiToInt(userPosition.netAmount);
          const totalValue = Math.abs(totalSize) * currentValue;
          const totalPaid = Math.abs(userPosition.totalPremium);
          const inProfit = totalValue < totalPaid;
          const title = `${renameOtoken(
            userPosition.symbol
          )} (${totalSize})`.toUpperCase();

          setPositionData({
            created,
            now,
            totalSize,
            totalValue,
            totalPaid,
            inProfit,
            title,
          });
        }
      }
    }
  }, [activeExpiry, data, tokenAddress, userPositions]);

  const addresses: Addresses = {
    exchange: exchangeAddress,
    collateral: collateralAsset,
    token: tokenAddress,
    user: address,
    vaultID: vaultID,
  };

  const collateralAmount = BigNumber.from(
    vaultData?.vault?.collateralAmount || "1"
  );
  const shortAmount = BigNumber.from(vaultData?.vault?.shortAmount || "0");

  const collateralPerOption =
    !collateralAmount.isZero() && !shortAmount.isZero()
      ? collateralAmount.mul(BIG_NUMBER_DECIMALS.OPYN).div(shortAmount)
      : BigNumber.from(0);

  return [
    addresses,
    allowance,
    setAllowance,
    positionData,
    collateralAmount,
    collateralPerOption,
  ] as const;
};
