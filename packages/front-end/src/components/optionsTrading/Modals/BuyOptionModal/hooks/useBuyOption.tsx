import type { Addresses } from "../../Shared/types";
import type { PositionDataState } from "../types";

import { captureException } from "@sentry/react";
import { fetchBalance } from "@wagmi/core";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { ZERO_ADDRESS } from "src/config/constants";
import { useGlobalContext } from "src/state/GlobalContext";
import { useOptionsTradingContext } from "src/state/OptionsTradingContext";
import {
  tFormatUSDC,
  toRysk,
  toUSDC,
  toWei,
  truncate,
} from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { useAllowance } from "../../Shared/hooks/useAllowance";
import { getQuote } from "../../Shared/utils/getQuote";

export const useBuyOption = (amountToBuy: string) => {
  // Global state.
  const {
    state: {
      ethPrice,
      options: { activeExpiry, data },
    },
  } = useGlobalContext();

  const {
    state: { selectedOption },
  } = useOptionsTradingContext();

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
          const { totalFees, totalPremium } = await getQuote(
            Number(activeExpiry),
            toRysk(selectedOption.strikeOptions.strike.toString()),
            selectedOption.callOrPut === "put",
            toWei(amount.toString()),
            selectedOption.buyOrSell === "sell"
          );
          const quoteForOne = truncate(
            data[activeExpiry!][selectedOption.strikeOptions.strike][
              selectedOption.callOrPut
            ].buy.quote.total,
            2
          );

          const fee = tFormatUSDC(totalFees) / Number(amountToBuy);
          const premium = tFormatUSDC(totalPremium) / Number(amountToBuy);
          const quote = tFormatUSDC(totalFees.add(totalPremium), 2);
          const remainingBalance = balance.isZero() ? 0 : balanceInt - quote;

          const requiredApproval = String(truncate(quote * 1.05, 2));
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
            slippage: Math.max(0, truncate(quote / amount / quoteForOne - 1)),
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
        captureException(error);
        setLoading(false);
      }
    };

    setPriceData(Number(amountToBuy));
  }, [amountToBuy, ethPrice]);

  const addresses: Addresses = {
    exchange: exchangeAddress,
    token: USDCAddress,
    user: address,
  };

  return [addresses, allowance, setAllowance, purchaseData, loading] as const;
};
