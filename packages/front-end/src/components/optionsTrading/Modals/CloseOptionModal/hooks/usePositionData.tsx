import type { Addresses } from "../../Shared/types";
import type { PositionDataState } from "../types";

import dayjs from "dayjs";
import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { getQuotes } from "src/components/shared/utils/getQuote";
import { useGlobalContext } from "src/state/GlobalContext";
import { toOpyn, toRysk } from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { useAllowance } from "../../Shared/hooks/useAllowance";

export const usePositionData = (amountToClose: string) => {
  // Global state.
  const {
    state: {
      balances,
      closingOption,
      ethPrice,
      options: { activeExpiry },
    },
  } = useGlobalContext();

  // Addresses.
  const { address } = useAccount();
  const tokenAddress = closingOption?.address || undefined;
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
        if (activeExpiry && tokenAddress && closingOption) {
          const now = dayjs().format("MMM DD, YYYY HH:mm A");

          const totalSize = closingOption.amount;
          const title = closingOption.series;

          if (amount > 0) {
            const [{ acceptablePremium, fee, premium, quote, slippage }] =
              await getQuotes([
                {
                  expiry: Number(activeExpiry),
                  strike: toRysk(closingOption.strike),
                  isPut: closingOption.isPut,
                  orderSize: amount,
                  isSell: true,
                },
              ]);

            const remainingBalance =
              balances.USDC === 0 ? 0 : balances.USDC + quote;
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
              remainingBalance: balances.USDC,
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
  }, [activeExpiry, amountToClose, ethPrice, tokenAddress]);

  const addresses: Addresses = {
    exchange: exchangeAddress,
    token: tokenAddress,
    user: address,
  };

  return [addresses, allowance, setAllowance, positionData, loading] as const;
};
