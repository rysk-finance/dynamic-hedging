import type { Addresses } from "../../Shared/types";
import type { PositionDataState, StrategyStrikesTuple } from "../types";

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
import { dateTimeNow, formatExpiry } from "../../Shared/utils/datetime";

export const useLongStraddleStrangle = (
  amountToOpen: string,
  strikes: StrategyStrikesTuple
) => {
  // Global state.
  const {
    state: {
      balances,
      ethPrice,
      options: { activeExpiry, data },
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
    expiry: formatExpiry(activeExpiry),
    exposure: [0, 0],
    fee: 0,
    now: dateTimeNow,
    premium: 0,
    quote: 0,
    remainingBalance: 0,
    requiredApproval: "",
    slippage: 0,
    strikes: strikes.map(Number) as [number, number],
  });

  const [loading, setLoading] = useState(false);
  const [debouncedLoading] = useDebounce(loading, 300);

  // Get user position price data.
  useEffect(() => {
    const setPriceData = async (
      amount: number,
      strikes: StrategyStrikesTuple
    ) => {
      setLoading(true);

      try {
        if (amount > 0 && strikes[0] && strikes[1]) {
          const [putQuote, callQuote] = await getQuotes([
            {
              expiry: Number(activeExpiry),
              strike: toRysk(strikes[0]),
              isPut: true,
              orderSize: amount,
              isSell: false,
            },
            {
              expiry: Number(activeExpiry),
              strike: toRysk(strikes[1]),
              isPut: false,
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
            putQuote.breakEven - (callQuote.breakEven - parseInt(strikes[0])),
            callQuote.breakEven + (parseInt(strikes[1]) - putQuote.breakEven),
          ];

          const callExposure =
            data[activeExpiry!][Number(strikes[0])].call?.exposure || 0;
          const putExposure =
            data[activeExpiry!][Number(strikes[1])].put?.exposure || 0;

          setPositionData({
            acceptablePremium: totalAcceptablePremium,
            breakEven,
            expiry: formatExpiry(activeExpiry),
            exposure: [putExposure, callExposure],
            fee: callQuote.fee + putQuote.fee,
            now: dateTimeNow,
            premium: callQuote.premium + putQuote.premium,
            quote: callQuote.quote + putQuote.quote,
            remainingBalance,
            requiredApproval,
            slippage: callQuote.slippage + putQuote.slippage,
            strikes: strikes.map(Number) as [number, number],
          });
          setAllowance((currentState) => ({ ...currentState, approved }));
        } else {
          setPositionData({
            acceptablePremium: BigNumber.from(0),
            breakEven: [0, 0],
            expiry: formatExpiry(activeExpiry),
            exposure: [0, 0],
            fee: 0,
            now: dateTimeNow,
            premium: 0,
            quote: 0,
            remainingBalance: balances.USDC,
            requiredApproval: "",
            slippage: 0,
            strikes: strikes.map(Number) as [number, number],
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

    setPriceData(Number(amountToOpen), strikes);
  }, [amountToOpen, allowance.amount, ethPrice, strikes]);

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
