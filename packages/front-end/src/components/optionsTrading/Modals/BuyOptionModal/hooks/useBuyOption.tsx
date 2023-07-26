import type { Addresses } from "../../Shared/types";
import type { PositionDataState } from "../types";

import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { BigNumber } from "ethers";
import { getQuotes } from "src/components/shared/utils/getQuote";
import { useGlobalContext } from "src/state/GlobalContext";
import {
  fromOpyn,
  tFormatUSDC,
  toOpyn,
  toRysk,
  toUSDC,
} from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { useAllowance } from "../../Shared/hooks/useAllowance";

export const useBuyOption = (amountToBuy: string) => {
  // Global state.
  const {
    state: {
      balances,
      ethPrice,
      options: { activeExpiry, data },
      selectedOption,
    },
  } = useGlobalContext();

  // Addresses.
  const { address } = useAccount();

  const USDCAddress = getContractAddress("USDC");
  const WETHAddress = getContractAddress("WETH");
  const exchangeAddress = getContractAddress("optionExchange");

  const optionExchangeBalance = BigNumber.from(
    (activeExpiry &&
      selectedOption &&
      data[activeExpiry][selectedOption.strikeOptions.strike][
        selectedOption.callOrPut
      ]!.exchangeBalances.WETH) ||
      0
  );
  const exchangeHasBalance = optionExchangeBalance.gte(toOpyn(amountToBuy));

  // User allowance state for USDC.
  const [allowance, setAllowance] = useAllowance(USDCAddress, address);

  // User position state.
  const [purchaseData, setPurchaseData] = useState<PositionDataState>({
    acceptablePremium: BigNumber.from(0),
    breakEven: 0,
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
        if (amount > 0 && selectedOption) {
          const [
            { acceptablePremium, breakEven, fee, premium, quote, slippage },
          ] = await getQuotes([
            {
              expiry: Number(activeExpiry),
              strike: toRysk(selectedOption.strikeOptions.strike.toString()),
              isPut: selectedOption.callOrPut === "put",
              orderSize: amount,
              isSell: false,
            },
          ]);

          const remainingBalance =
            balances.USDC === 0 ? 0 : balances.USDC - quote;

          const requiredApproval = String(tFormatUSDC(acceptablePremium, 4));
          const approved = toUSDC(requiredApproval).lte(allowance.amount);

          setPurchaseData({
            acceptablePremium,
            breakEven,
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
            acceptablePremium: BigNumber.from(0),
            breakEven: 0,
            callOrPut: selectedOption?.callOrPut,
            expiry: dayjs.unix(Number(activeExpiry)).format("DDMMMYY"),
            fee: 0,
            now: dayjs().format("MMM DD, YYYY HH:mm A"),
            premium: 0,
            quote: 0,
            remainingBalance: balances.USDC,
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
  }, [amountToBuy, allowance.amount, ethPrice]);

  const addresses: Addresses = {
    collateral: exchangeHasBalance ? WETHAddress : USDCAddress,
    exchange: exchangeAddress,
    token: USDCAddress,
    user: address,
  };

  return [addresses, allowance, setAllowance, purchaseData, loading] as const;
};
