import type { Addresses, AllowanceState, PositionDataState } from "../types";

import { readContract } from "@wagmi/core";
import dayjs from "dayjs";
import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAccount } from "wagmi";

import { erc20ABI } from "src/abis/erc20_ABI";
import { useGlobalContext } from "src/state/GlobalContext";
import { fromOpynToNumber, fromWeiToInt } from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { renameOtoken } from "src/utils/conversion-helper";

export const usePositionData = () => {
  // URL query params.
  const [searchParams] = useSearchParams();

  // Addresses.
  const { address } = useAccount();
  const tokenAddress = (searchParams.get("token") as HexString) || undefined;
  const exchangeAddress = getContractAddress("optionExchange");

  // Context state.
  const {
    state: {
      options: { activeExpiry, data, userPositions },
    },
  } = useGlobalContext();

  // User allowance state for the oToken.
  const [allowance, setAllowance] = useState<AllowanceState>({
    approved: false,
    amount: BigNumber.from(0),
  });

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

  /* Effects */

  // Get user oToken allowance.
  useEffect(() => {
    const checkApproval = async () => {
      if (address && tokenAddress) {
        const amount = await readContract({
          address: tokenAddress,
          abi: erc20ABI,
          functionName: "allowance",
          args: [address, exchangeAddress],
        });

        setAllowance((currentState) => ({ ...currentState, amount }));
      }
    };

    checkApproval();
  }, [address, allowance.approved, tokenAddress]);

  // Get user position data.
  useEffect(() => {
    if (activeExpiry && tokenAddress && userPositions) {
      const userPosition = userPositions[activeExpiry]?.tokens.find(
        ({ id }) => id === searchParams.get("token")
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
          const totalValue = totalSize * currentValue;
          const totalPaid = userPosition.totalPremium;
          const inProfit = totalValue > totalPaid;
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
    token: tokenAddress,
    user: address,
  };

  return [addresses, allowance, setAllowance, positionData] as const;
};
