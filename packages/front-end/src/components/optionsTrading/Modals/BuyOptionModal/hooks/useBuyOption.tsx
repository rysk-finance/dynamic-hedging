import type { Addresses } from "../../Shared/types";
import type { PositionDataState } from "../types";

import { fetchBalance } from "@wagmi/core";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { ZERO_ADDRESS } from "src/config/constants";
import { useGlobalContext } from "src/state/GlobalContext";
import {
  tFormatUSDC,
  toRysk,
  toUSDC,
  toWei,
  truncate,
} from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { useAllowance } from "../../Shared/hooks/useAllowance";
import { getQuote } from "../../Shared/utils/getQuote";

export const useBuyOption = (amountToBuy: string) => {
  // Global state.
  const {
    state: {
      ethPrice,
      options: { activeExpiry, data },
      selectedOption,
    },
  } = useGlobalContext();

  // Addresses.
  const { address } = useAccount();
  const USDCAddress = getContractAddress("USDC");
  const exchangeAddress = getContractAddress("optionExchange");

  // User allowance state for USDC.
  const [allowance, setAllowance] = useAllowance(USDCAddress, address);

  // User position state.
  const [purchaseData, setPurchaseData] = useState<PositionDataState>({
    callOrPut: selectedOption?.callOrPut,
    expiry: dayjs.unix(Number(activeExpiry)).format("DDMMMYY"),
    fee: 0,
    now: dayjs().format("MMM DD, YYYY HH:mm A"),
    premium: 0,
    quote: 0,
    remainingBalance: 0,
    requiredApproval: "",
    slippage: 0,
    strike: selectedOption?.strikeOptions?.strike,
  });

  const [loading, setLoading] = useState(false);

  // Get user position price data.
  useEffect(() => {
    const setPriceData = async (amount: number) => {
      setLoading(true);

      try {
        const { value: balance } = await fetchBalance({
          address: address || ZERO_ADDRESS,
          token: getContractAddress("USDC"),
        });
        const balanceInt = tFormatUSDC(balance);

        if (amount > 0 && selectedOption) {
          const { fee, premium, quote, slippage } = await getQuote(
            Number(activeExpiry),
            toRysk(selectedOption.strikeOptions.strike.toString()),
            selectedOption.callOrPut === "put",
            amount,
            selectedOption.buyOrSell === "sell"
          );

          const remainingBalance = balance.isZero() ? 0 : balanceInt - quote;

          const requiredApproval = String(truncate(quote * 1.05, 4));
          const approved = toUSDC(requiredApproval).lte(allowance.amount);

          setPurchaseData({
            callOrPut: selectedOption.callOrPut,
            expiry: dayjs.unix(Number(activeExpiry)).format("DDMMMYY"),
            fee,
            now: dayjs().format("MMM DD, YYYY HH:mm A"),
            premium,
            quote,
            remainingBalance,
            requiredApproval,
            slippage,
            strike: selectedOption.strikeOptions.strike,
          });
          setAllowance((currentState) => ({ ...currentState, approved }));
        } else {
          setPurchaseData({
            callOrPut: selectedOption?.callOrPut,
            expiry: dayjs.unix(Number(activeExpiry)).format("DDMMMYY"),
            fee: 0,
            now: dayjs().format("MMM DD, YYYY HH:mm A"),
            premium: 0,
            quote: 0,
            remainingBalance: balanceInt,
            requiredApproval: "",
            slippage: 0,
            strike: selectedOption?.strikeOptions?.strike,
          });
          setAllowance((currentState) => ({
            ...currentState,
            approved: false,
          }));
        }

        setLoading(false);
      } catch (error) {
        logError(error);
        setLoading(false);
      }
    };

    setPriceData(Number(amountToBuy));
  }, [amountToBuy, ethPrice, selectedOption]);

  const addresses: Addresses = {
    exchange: exchangeAddress,
    token: USDCAddress,
    user: address,
  };

  return [addresses, allowance, setAllowance, purchaseData, loading] as const;
};
