import type { Addresses, AllowanceState } from "../../Shared/types";
import type { PositionDataState } from "../types";

import { captureException } from "@sentry/react";
import { fetchBalance, readContract } from "@wagmi/core";
import dayjs from "dayjs";
import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { erc20ABI } from "src/abis/erc20_ABI";
import { ZERO_ADDRESS } from "src/config/constants";
import { useGlobalContext } from "src/state/GlobalContext";
import { useOptionsTradingContext } from "src/state/OptionsTradingContext";
import {
  tFormatUSDC,
  toRysk,
  toUSDC,
  toWei,
} from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { toTwoDecimalPlaces } from "src/utils/rounding";
import { getQuote } from "../../Shared/utils/getQuote";

export const useBuyOption = (amountToBuy: string) => {
  // Global state.
  const {
    state: {
      ethPrice,
      options: { activeExpiry },
    },
  } = useGlobalContext();

  const {
    state: { selectedOption },
  } = useOptionsTradingContext();

  // Addresses.
  const { address } = useAccount();
  const USDCAddress = getContractAddress("USDC");
  const exchangeAddress = getContractAddress("optionExchange");

  // User allowance state for the oToken.
  const [allowance, setAllowance] = useState<AllowanceState>({
    approved: false,
    amount: BigNumber.from(0),
  });

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
    strike: selectedOption?.strikeOptions?.strike,
  });

  const [loading, setLoading] = useState(false);

  /* Effects */

  // Get user oToken allowance.
  useEffect(() => {
    const checkApproval = async () => {
      if (address) {
        const amount = await readContract({
          address: USDCAddress,
          abi: erc20ABI,
          functionName: "allowance",
          args: [address, exchangeAddress],
        });

        setAllowance((currentState) => ({ ...currentState, amount }));
      }
    };

    checkApproval();
  }, [address, allowance.approved, USDCAddress]);

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

          const fee = tFormatUSDC(totalFees);
          const premium = tFormatUSDC(totalPremium);
          const quote = tFormatUSDC(totalFees.add(totalPremium));
          const remainingBalance = balance ? balanceInt - quote : 0;

          const requiredApproval = String(toTwoDecimalPlaces(quote * 1.05));
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
