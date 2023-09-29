import type { Addresses } from "../../Shared/types";
import type { PositionDataState } from "../types";

import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { useAccount } from "wagmi";

import { getQuotes } from "src/components/shared/utils/getQuote";
import { useGlobalContext } from "src/state/GlobalContext";
import { Convert } from "src/utils/Convert";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { useAllowance } from "../../Shared/hooks/useAllowance";
import { dateTimeNow, formatExpiry } from "../../Shared/utils/datetime";

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
    callOrPut: closingOption?.isPut ? "put" : "call",
    expiry: formatExpiry(activeExpiry),
    fee: 0,
    maxCloseSize: 0,
    now: dateTimeNow(),
    operation: "sell",
    orderTooBig: false,
    premium: 0,
    quote: 0,
    remainingBalance: 0,
    slippage: 0,
    totalSize: 0,
    strike: closingOption?.strikes
      ? Convert.fromStr(closingOption.strikes[0]).toInt()
      : undefined,
  });

  const [loading, setLoading] = useState(false);
  const [debouncedLoading] = useDebounce(loading, 300);

  // Get user position data.
  useEffect(() => {
    const setPriceData = async (amount: number) => {
      setLoading(true);

      try {
        if (activeExpiry && tokenAddress && closingOption) {
          const now = dateTimeNow();

          const totalSize = closingOption.amount;

          if (amount > 0) {
            const [{ acceptablePremium, fee, premium, quote, slippage }] =
              await getQuotes([
                {
                  expiry: Number(activeExpiry),
                  strike: Convert.fromStr(closingOption.strikes[0]).toWei(),
                  isPut: closingOption.isPut,
                  orderSize: amount,
                  isSell: true,
                },
              ]);

            const remainingBalance =
              balances.USDC === 0 ? 0 : balances.USDC + quote;
            const approved = Convert.fromStr(amountToClose)
              .toOpyn()
              .lte(allowance.amount);

            setPositionData({
              acceptablePremium,
              callOrPut: closingOption.isPut ? "put" : "call",
              expiry: formatExpiry(activeExpiry),
              fee,
              maxCloseSize: closingOption?.shortUSDCExposure,
              now,
              operation: closingOption?.shortUSDCExposure ? "close" : "sell",
              orderTooBig: Boolean(
                closingOption?.shortUSDCExposure &&
                  amount > closingOption.shortUSDCExposure
              ),
              premium,
              quote,
              remainingBalance,
              slippage,
              totalSize,
              strike: Convert.fromStr(closingOption.strikes[0]).toInt(),
            });
            setAllowance((currentState) => ({ ...currentState, approved }));
          } else {
            setPositionData({
              acceptablePremium: BigNumber.from(0),
              callOrPut: closingOption?.isPut ? "put" : "call",
              expiry: formatExpiry(activeExpiry),
              fee: 0,
              maxCloseSize: 0,
              now,
              operation: "sell",
              orderTooBig: false,
              premium: 0,
              quote: 0,
              remainingBalance: balances.USDC,
              slippage: 0,
              totalSize,
              strike: closingOption?.strikes
                ? Convert.fromStr(closingOption.strikes[0]).toInt()
                : undefined,
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

  return [
    addresses,
    allowance,
    setAllowance,
    positionData,
    debouncedLoading,
  ] as const;
};
