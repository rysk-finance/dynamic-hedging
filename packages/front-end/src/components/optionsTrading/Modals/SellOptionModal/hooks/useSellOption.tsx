import type { Addresses } from "../../Shared/types";
import type { PositionDataState } from "../types";

import { readContract } from "@wagmi/core";
import dayjs from "dayjs";
import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { NewMarginCalculatorABI } from "src/abis/NewMarginCalculator_ABI";
import { DECIMALS } from "src/config/constants";
import { useGlobalContext } from "src/state/GlobalContext";
import {
  fromRyskToNumber,
  tFormatUSDC,
  toOpyn,
  toRysk,
  toUSDC,
  truncate,
} from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { useAllowance } from "../../Shared/hooks/useAllowance";
import { getLiquidationPrice } from "../../Shared/utils/getLiquidationPrice";
import { getQuote } from "../../Shared/utils/getQuote";

export const useSellOption = (amountToSell: string) => {
  // Global state.
  const {
    state: {
      balances,
      collateralPreferences,
      ethPrice,
      options: { activeExpiry, spotShock, timesToExpiry },
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
    acceptablePremium: BigNumber.from(0),
    callOrPut: selectedOption?.callOrPut,
    collateral: 0,
    expiry: dayjs.unix(Number(activeExpiry)).format("DDMMMYY"),
    fee: 0,
    hasRequiredCapital: false,
    liquidationPrice: 0,
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
        const { USDC: balanceUSDC, WETH: balanceWETH } = balances;

        if (amount > 0 && ethPrice && selectedOption) {
          const strike = selectedOption.strikeOptions.strike;

          const { acceptablePremium, fee, premium, quote, slippage } =
            await getQuote(
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

            if (collateralPreferences.full) {
              if (USDCCollateral) {
                return Number(strike) * Number(amount);
              } else {
                return Number(amount);
              }
            } else {
              const multipliedCollateral = requiredCollateral
                .mul(collateralPreferences.amount * 10)
                .div(10);
              const formatted = USDCCollateral
                ? tFormatUSDC(multipliedCollateral)
                : fromRyskToNumber(multipliedCollateral.toString());
              const maximum = USDCCollateral ? strike * amount : amount;

              if (selectedOption.callOrPut === "put") {
                return USDCCollateral
                  ? Math.min(formatted, maximum)
                  : formatted;
              } else {
                return USDCCollateral
                  ? formatted
                  : Math.min(formatted, maximum);
              }
            }
          };

          const collateral = await _getCollateralAmount();

          const remainingBalanceUSDC =
            balanceUSDC + quote - (USDCCollateral ? collateral : 0);
          const remainingBalanceWETH = USDCCollateral
            ? balanceWETH
            : balanceWETH - collateral;

          const approvalBuffer = 1.005;
          // Ensure user has sufficient wallet balance to cover collateral + buffer.
          const hasRequiredCapital = USDCCollateral
            ? balanceUSDC > collateral * approvalBuffer
            : balanceWETH > collateral * approvalBuffer;

          const requiredApproval = String(
            truncate(collateral * approvalBuffer, 4)
          );
          const approved = (
            USDCCollateral ? toUSDC(requiredApproval) : toRysk(requiredApproval)
          ).lte(allowance.amount);

          const liquidationPrice = collateralPreferences.full
            ? 0
            : await getLiquidationPrice(
                amount,
                selectedOption.callOrPut,
                collateral,
                collateralAddress,
                ethPrice,
                Number(activeExpiry),
                spotShock,
                selectedOption.strikeOptions.strike,
                timesToExpiry
              );

          setPurchaseData({
            acceptablePremium,
            callOrPut: selectedOption.callOrPut,
            collateral,
            expiry: dayjs.unix(Number(activeExpiry)).format("DDMMMYY"),
            fee,
            hasRequiredCapital,
            liquidationPrice,
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
            acceptablePremium: BigNumber.from(0),
            callOrPut: selectedOption?.callOrPut,
            collateral: 0,
            expiry: dayjs.unix(Number(activeExpiry)).format("DDMMMYY"),
            fee: 0,
            hasRequiredCapital: false,
            liquidationPrice: 0,
            now: dayjs().format("MMM DD, YYYY HH:mm A"),
            premium: 0,
            quote: 0,
            remainingBalanceUSDC: balanceUSDC,
            remainingBalanceWETH: balanceWETH,
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

    setPriceData(Number(amountToSell));
  }, [amountToSell, allowance.amount, collateralPreferences, ethPrice]);

  const addresses: Addresses = {
    exchange: exchangeAddress,
    token: collateralAddress,
    user: address,
  };

  return [addresses, allowance, setAllowance, purchaseData, loading] as const;
};
