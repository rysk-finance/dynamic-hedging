import type { Addresses } from "../../Shared/types";
import type { PositionDataState } from "../types";

import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { useAccount } from "wagmi";

import { BigNumber } from "ethers";
import { getQuotes } from "src/components/shared/utils/getQuote";
import { useGlobalContext } from "src/state/GlobalContext";
import { tFormatUSDC, toRysk, toUSDC } from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { useAllowance } from "../../Shared/hooks/useAllowance";

export const useLongStraddle = (amountToOpen: string, strike: string) => {
  // Global state.
  const {
    state: {
      balances,
      ethPrice,
      options: { activeExpiry },
    },
  } = useGlobalContext();

  // Addresses.
  const { address } = useAccount();

  const USDCAddress = getContractAddress("USDC");
  const exchangeAddress = getContractAddress("optionExchange");

  // User allowance state for USDC.
  const [allowance, setAllowance] = useAllowance(USDCAddress, address);

  // User position state.
  const [positionData, setPositionData] = useState<PositionDataState>({
    acceptablePremium: BigNumber.from(0),
    breakEven: [0, 0],
    expiry: dayjs.unix(Number(activeExpiry)).format("DDMMMYY"),
    fee: 0,
    now: dayjs().format("MMM DD, YYYY HH:mm A"),
    premium: 0,
    quote: 0,
    remainingBalance: 0,
    requiredApproval: "",
    slippage: 0,
    strike: parseInt(strike),
  });

  const [loading, setLoading] = useState(false);
  const [debouncedLoading] = useDebounce(loading, 300);

  // Get user position price data.
  useEffect(() => {
    const setPriceData = async (amount: number, strike: string) => {
      setLoading(true);

      try {
        if (amount > 0 && strike) {
          const [callQuote, putQuote] = await getQuotes([
            {
              expiry: Number(activeExpiry),
              strike: toRysk(strike),
              isPut: false,
              orderSize: amount,
              isSell: false,
            },
            {
              expiry: Number(activeExpiry),
              strike: toRysk(strike),
              isPut: true,
              orderSize: amount,
              isSell: false,
            },
          ]);

          const remainingBalance =
            balances.USDC === 0
              ? 0
              : balances.USDC - callQuote.quote - putQuote.quote;

          const totalAcceptablePremium = callQuote.acceptablePremium.add(
            putQuote.acceptablePremium
          );
          const requiredApproval = String(
            tFormatUSDC(
              callQuote.acceptablePremium.add(putQuote.acceptablePremium),
              4
            )
          );
          const approved = toUSDC(requiredApproval).lte(allowance.amount);

          const breakEven: [number, number] = [
            callQuote.breakEven + (parseInt(strike) - putQuote.breakEven),
            putQuote.breakEven - (callQuote.breakEven - parseInt(strike)),
          ];

          setPositionData({
            acceptablePremium: totalAcceptablePremium,
            breakEven,
            expiry: dayjs.unix(Number(activeExpiry)).format("DDMMMYY"),
            fee: callQuote.fee + putQuote.fee,
            now: dayjs().format("MMM DD, YYYY HH:mm A"),
            premium: callQuote.premium + putQuote.premium,
            quote: callQuote.quote + putQuote.quote,
            remainingBalance,
            requiredApproval,
            slippage: callQuote.slippage + putQuote.slippage,
            strike: parseFloat(strike),
          });
          setAllowance((currentState) => ({ ...currentState, approved }));
        } else {
          setPositionData({
            acceptablePremium: BigNumber.from(0),
            breakEven: [0, 0],
            expiry: dayjs.unix(Number(activeExpiry)).format("DDMMMYY"),
            fee: 0,
            now: dayjs().format("MMM DD, YYYY HH:mm A"),
            premium: 0,
            quote: 0,
            remainingBalance: balances.USDC,
            requiredApproval: "",
            slippage: 0,
            strike: parseFloat(strike),
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

    setPriceData(Number(amountToOpen), strike);
  }, [amountToOpen, allowance.amount, ethPrice, strike]);

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
    positionData,
    debouncedLoading,
  ] as const;
};
