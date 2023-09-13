import type { Addresses } from "../../Shared/types";
import type { PositionDataState } from "../types";

import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { useAccount } from "wagmi";

import { BigNumber } from "ethers";
import { getQuotes } from "src/components/shared/utils/getQuote";
import { useGlobalContext } from "src/state/GlobalContext";
import { Convert } from "src/utils/Convert";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { useAllowance } from "../../Shared/hooks/useAllowance";
import { dateTimeNow, formatExpiry } from "../../Shared/utils/datetime";

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
  const exchangeAddress = getContractAddress("optionExchange");

  // User allowance state for USDC.
  const [allowance, setAllowance] = useAllowance(USDCAddress, address);

  // User position state.
  const [purchaseData, setPurchaseData] = useState<PositionDataState>({
    acceptablePremium: BigNumber.from(0),
    breakEven: 0,
    callOrPut: selectedOption?.callOrPut,
    expiry: formatExpiry(activeExpiry),
    exposure: 0,
    fee: 0,
    now: dateTimeNow(),
    premium: 0,
    quote: 0,
    remainingBalance: 0,
    requiredApproval: "",
    slippage: 0,
    strike: selectedOption?.strikeOptions?.strike,
  });

  const [loading, setLoading] = useState(false);
  const [debouncedLoading] = useDebounce(loading, 300);

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
              strike: Convert.fromInt(
                selectedOption.strikeOptions.strike
              ).toWei(),
              isPut: selectedOption.callOrPut === "put",
              orderSize: amount,
              isSell: false,
            },
          ]);

          const remainingBalance =
            balances.USDC === 0 ? 0 : balances.USDC - quote;

          const requiredApproval = Convert.fromUSDC(acceptablePremium).toStr();
          const approved = Convert.fromStr(requiredApproval)
            .toUSDC()
            .lte(allowance.amount);

          const exposure =
            data[activeExpiry!][selectedOption.strikeOptions.strike][
              selectedOption.callOrPut
            ]?.exposure.net || 0;

          setPurchaseData({
            acceptablePremium,
            breakEven,
            callOrPut: selectedOption.callOrPut,
            expiry: formatExpiry(activeExpiry),
            exposure,
            fee,
            now: dateTimeNow(),
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
            expiry: formatExpiry(activeExpiry),
            exposure: 0,
            fee: 0,
            now: dateTimeNow(),
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
    collateral: USDCAddress,
    exchange: exchangeAddress,
    token: USDCAddress,
    user: address,
  };

  return [
    addresses,
    allowance,
    setAllowance,
    purchaseData,
    debouncedLoading,
  ] as const;
};
