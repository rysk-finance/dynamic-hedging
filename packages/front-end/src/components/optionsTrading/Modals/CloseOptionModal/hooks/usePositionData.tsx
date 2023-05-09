import type { Addresses } from "../../Shared/types";
import type { PositionDataState } from "../types";

import { fetchBalance } from "@wagmi/core";
import dayjs from "dayjs";
import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAccount } from "wagmi";

import { ZERO_ADDRESS } from "src/config/constants";
import { useGlobalContext } from "src/state/GlobalContext";
import {
  fromOpyn,
  fromWeiToInt,
  renameOtoken,
  tFormatUSDC,
  toOpyn,
  toRysk,
} from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { useAllowance } from "../../Shared/hooks/useAllowance";
import { getQuote } from "../../Shared/utils/getQuote";
import { optionSymbolFromOToken } from "src/utils";

export const usePositionData = (amountToClose: string) => {
  // Global state.
  const {
    state: {
      ethPrice,
      options: { activeExpiry, userPositions },
    },
  } = useGlobalContext();

  // URL query params.
  const [searchParams] = useSearchParams();

  // Addresses.
  const { address } = useAccount();
  const tokenAddress = (searchParams.get("token") as HexString) || undefined;
  const exchangeAddress = getContractAddress("optionExchange");

  // User allowance state for the oToken.
  const [allowance, setAllowance] = useAllowance(tokenAddress, address);

  // User position state.
  const [positionData, setPositionData] = useState<PositionDataState>({
    acceptablePremium: BigNumber.from(0),
    fee: 0,
    now: dayjs().format("MMM DD, YYYY HH:mm A"),
    premium: 0,
    quote: 0,
    remainingBalance: 0,
    slippage: 0,
    totalSize: 0,
    title: null,
  });

  const [loading, setLoading] = useState(false);

  // Get user position data.
  useEffect(() => {
    const setPriceData = async (amount: number) => {
      setLoading(true);

      try {
        const { value: balance } = await fetchBalance({
          address: address || ZERO_ADDRESS,
          token: getContractAddress("USDC"),
        });
        const balanceInt = tFormatUSDC(balance);

        if (activeExpiry && tokenAddress && userPositions) {
          const userPosition = userPositions[activeExpiry]?.tokens.find(
            ({ id }) => id === searchParams.get("token")
          );

          const now = dayjs().format("MMM DD, YYYY HH:mm A");

          const totalSize = fromWeiToInt(userPosition?.netAmount || 0);
          const title = `${
            !userPosition?.symbol
              ? renameOtoken(userPosition?.symbol || "")
              : optionSymbolFromOToken(
                  userPosition?.isPut || false,
                  userPosition?.expiryTimestamp || "0",
                  userPosition?.strikePrice.toString() || "0"
                )
          } (${totalSize})`.toUpperCase();

          if (amount > 0 && userPosition) {
            const { acceptablePremium, fee, premium, quote, slippage } =
              await getQuote(
                Number(activeExpiry),
                toRysk(fromOpyn(userPosition.strikePrice)),
                userPosition.isPut,
                amount,
                true
              );

            const remainingBalance = balance.isZero() ? 0 : balanceInt + quote;
            const approved = toOpyn(amountToClose).lte(allowance.amount);

            setPositionData({
              acceptablePremium,
              fee,
              now,
              premium,
              quote,
              remainingBalance,
              slippage,
              totalSize,
              title,
            });
            setAllowance((currentState) => ({ ...currentState, approved }));
          } else {
            setPositionData({
              acceptablePremium: BigNumber.from(0),
              fee: 0,
              now,
              premium: 0,
              quote: 0,
              remainingBalance: balanceInt,
              slippage: 0,
              totalSize,
              title,
            });
            setAllowance((currentState) => ({
              ...currentState,
              approved: false,
            }));
          }
        }

        setLoading(false);
      } catch (error) {
        logError(error);
        setLoading(false);
      }
    };

    setPriceData(Number(amountToClose));
  }, [activeExpiry, amountToClose, ethPrice, tokenAddress, userPositions]);

  const addresses: Addresses = {
    exchange: exchangeAddress,
    token: tokenAddress,
    user: address,
  };

  return [addresses, allowance, setAllowance, positionData, loading] as const;
};
