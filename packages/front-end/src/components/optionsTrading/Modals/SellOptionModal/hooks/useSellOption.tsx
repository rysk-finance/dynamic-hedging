import type { Addresses } from "../../Shared/types";
import type { PositionDataState } from "../types";

import { captureException } from "@sentry/react";
import { readContract } from "@wagmi/core";
import dayjs from "dayjs";
import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { NewMarginCalculatorABI } from "src/abis/NewMarginCalculator_ABI";
import { DECIMALS } from "src/config/constants";
import { useGlobalContext } from "src/state/GlobalContext";
import { CollateralAmount } from "src/state/types";
import {
  fromRyskToNumber,
  tFormatUSDC,
  toOpyn,
  toRysk,
  toUSDC,
  truncate,
} from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { useAllowance } from "../../Shared/hooks/useAllowance";
import { getBalancesAsInteger } from "../../Shared/utils/getBalancesAsInteger";
import { getQuote } from "../../Shared/utils/getQuote";

const multipliers = {
  [CollateralAmount["1.5x"]]: 15,
  [CollateralAmount["2x"]]: 20,
  [CollateralAmount["3x"]]: 30,
};

export const useSellOption = (amountToSell: string) => {
  // Global state.
  const {
    state: {
      collateralPreferences,
      ethPrice,
      options: { activeExpiry, data },
      selectedOption,
    },
  } = useGlobalContext();

  // Collateral type.
  const USDCCollateral = collateralPreferences.type === "USDC";

  // Addresses.
  const { address } = useAccount();
  const USDCAddress = getContractAddress("USDC");
  const WETHAddress = getContractAddress("WETH");
  const collateralAddress = USDCCollateral ? USDCAddress : WETHAddress;
  const exchangeAddress = getContractAddress("optionExchange");
  const marginCalculatorAddress = getContractAddress("OpynNewCalculator");

  // User allowance state for the collateral asset.
  const [allowance, setAllowance] = useAllowance(collateralAddress, address);

  // User position state.
  const [purchaseData, setPurchaseData] = useState<PositionDataState>({
    acceptablePremium:BigNumber.from(0),
    callOrPut: selectedOption?.callOrPut,
    collateral: 0,
    expiry: dayjs.unix(Number(activeExpiry)).format("DDMMMYY"),
    fee: 0,
    now: dayjs().format("MMM DD, YYYY HH:mm A"),
    premium: 0,
    quote: 0,
    remainingBalanceUSDC: 0,
    remainingBalanceWETH: 0,
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
        const { USDC: balanceUSDCInt, WETH: balanceWETHInt } =
          await getBalancesAsInteger(address);

        if (amount > 0 && ethPrice && selectedOption) {
          const strike = selectedOption.strikeOptions.strike;

          const {acceptablePremium, fee, premium, quote, slippage } = await getQuote(
            Number(activeExpiry),
            toRysk(strike.toString()),
            selectedOption.callOrPut === "put",
            amount,
            selectedOption.buyOrSell === "sell",
            collateralPreferences.type
          );

          const _getCollateralAmount = async () => {
            const requiredCollateral = await readContract({
              address: marginCalculatorAddress,
              abi: NewMarginCalculatorABI,
              functionName: "getNakedMarginRequired",
              args: [
                WETHAddress,
                USDCAddress,
                collateralAddress,
                toOpyn(amountToSell),
                toOpyn(strike.toString()),
                toOpyn(ethPrice.toString()),
                BigNumber.from(activeExpiry),
                BigNumber.from(USDCCollateral ? DECIMALS.USDC : DECIMALS.RYSK),
                selectedOption.callOrPut === "put",
              ],
            });

            if (collateralPreferences.amount === CollateralAmount["full"]) {
              if (USDCCollateral) {
                return Number(strike) * Number(amount);
              } else {
                return Number(amount);
              }
            } else {
              const multipliedCollateral = requiredCollateral
                .mul(multipliers[collateralPreferences.amount])
                .div(10);
              const formatted = USDCCollateral
                ? tFormatUSDC(multipliedCollateral)
                : fromRyskToNumber(multipliedCollateral.toString());

              return Math.min(formatted, strike * Number(amountToSell));
            }
          };

          const collateral = await _getCollateralAmount();

          const remainingBalanceUSDC =
            balanceUSDCInt + quote - (USDCCollateral ? collateral : 0);
          const remainingBalanceWETH = USDCCollateral
            ? balanceWETHInt
            : balanceWETHInt - collateral;

          const requiredApproval = String(truncate(collateral * 1.05, 4));
          const approved = (
            USDCCollateral ? toUSDC(requiredApproval) : toRysk(requiredApproval)
          ).lte(allowance.amount);

          setPurchaseData({
            acceptablePremium,
            callOrPut: selectedOption.callOrPut,
            collateral,
            expiry: dayjs.unix(Number(activeExpiry)).format("DDMMMYY"),
            fee,
            now: dayjs().format("MMM DD, YYYY HH:mm A"),
            premium,
            quote,
            remainingBalanceUSDC,
            remainingBalanceWETH,
            requiredApproval,
            slippage,
            strike,
          });
          setAllowance((currentState) => ({ ...currentState, approved }));
        } else {
          setPurchaseData({
            acceptablePremium:BigNumber.from(0),
            callOrPut: selectedOption?.callOrPut,
            collateral: 0,
            expiry: dayjs.unix(Number(activeExpiry)).format("DDMMMYY"),
            fee: 0,
            now: dayjs().format("MMM DD, YYYY HH:mm A"),
            premium: 0,
            quote: 0,
            remainingBalanceUSDC: balanceUSDCInt,
            remainingBalanceWETH: balanceWETHInt,
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

    setPriceData(Number(amountToSell));
  }, [amountToSell, allowance.amount, collateralPreferences, ethPrice]);

  const addresses: Addresses = {
    exchange: exchangeAddress,
    token: collateralAddress,
    user: address,
  };

  return [addresses, allowance, setAllowance, purchaseData, loading] as const;
};
