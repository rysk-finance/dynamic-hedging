import type { Addresses } from "../../Shared/types";
import type { PositionDataState } from "../types";

import { readContract } from "@wagmi/core";
import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { useAccount } from "wagmi";

import { NewMarginCalculatorABI } from "src/abis/NewMarginCalculator_ABI";
import { getQuotes } from "src/components/shared/utils/getQuote";
import { DECIMALS } from "src/config/constants";
import { useGlobalContext } from "src/state/GlobalContext";
import { Convert } from "src/utils/Convert";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { getLiquidationPrices } from "../../../../shared/utils/getLiquidationPrice";
import { useAllowance } from "../../Shared/hooks/useAllowance";
import { dateTimeNow, formatExpiry } from "../../Shared/utils/datetime";

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

  const callOrPut = selectedOption?.callOrPut;
  const oTokenAddress =
    callOrPut &&
    selectedOption?.strikeOptions[callOrPut]?.exchangeAddresses[
      collateralPreferences.type
    ];

  const exchangeAddress = getContractAddress("optionExchange");
  const marginCalculatorAddress = getContractAddress("OpynNewCalculator");

  // User allowance state for the collateral asset.
  const [allowance, setAllowance] = useAllowance(collateralAddress, address);

  // User position state.
  const [purchaseData, setPurchaseData] = useState<PositionDataState>({
    acceptablePremium: BigNumber.from(0),
    breakEven: 0,
    callOrPut: selectedOption?.callOrPut,
    collateral: 0,
    expiry: formatExpiry(activeExpiry),
    fee: 0,
    hasRequiredCapital: false,
    liquidationPrice: 0,
    now: dateTimeNow(),
    premium: 0,
    quote: 0,
    remainingBalanceUSDC: 0,
    remainingBalanceWETH: 0,
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
        const { USDC: balanceUSDC, WETH: balanceWETH } = balances;

        if (amount > 0 && ethPrice && selectedOption) {
          const strike = selectedOption.strikeOptions.strike;

          const [
            { acceptablePremium, breakEven, fee, premium, quote, slippage },
          ] = await getQuotes([
            {
              expiry: Number(activeExpiry),
              strike: Convert.fromInt(strike).toWei(),
              isPut: selectedOption.callOrPut === "put",
              orderSize: amount,
              isSell: selectedOption.buyOrSell === "sell",
              collateral: collateralPreferences.type,
            },
          ]);

          const _getCollateralAmount = async () => {
            const requiredCollateral = await readContract({
              address: marginCalculatorAddress,
              abi: NewMarginCalculatorABI,
              functionName: "getNakedMarginRequired",
              args: [
                WETHAddress,
                USDCAddress,
                collateralAddress,
                Convert.fromStr(amountToSell).toOpyn(),
                Convert.fromInt(strike).toOpyn(),
                Convert.fromInt(ethPrice).toOpyn(),
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
                .mul(Math.round(collateralPreferences.amount * 100))
                .div(100);
              const formatted = USDCCollateral
                ? Convert.fromUSDC(multipliedCollateral).toInt()
                : Convert.fromWei(multipliedCollateral, 4).toInt();
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

          const requiredApproval = Convert.fromInt(
            collateral * approvalBuffer,
            4
          ).toStr();
          const approved = (
            USDCCollateral
              ? Convert.fromStr(requiredApproval).toUSDC()
              : Convert.fromStr(requiredApproval).toWei()
          ).lte(allowance.amount);

          const [liquidationPrice] = collateralPreferences.full
            ? [0]
            : await getLiquidationPrices(
                [
                  {
                    amount,
                    callOrPut: selectedOption.callOrPut,
                    collateral,
                    collateralAddress,
                    expiry: Number(activeExpiry),
                    strikePrice: selectedOption.strikeOptions.strike,
                  },
                ],
                ethPrice,
                spotShock,
                timesToExpiry
              );

          setPurchaseData({
            acceptablePremium,
            breakEven,
            callOrPut: selectedOption.callOrPut,
            collateral,
            expiry: formatExpiry(activeExpiry),
            fee,
            hasRequiredCapital,
            liquidationPrice,
            now: dateTimeNow(),
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
            breakEven: 0,
            callOrPut: selectedOption?.callOrPut,
            collateral: 0,
            expiry: formatExpiry(activeExpiry),
            fee: 0,
            hasRequiredCapital: false,
            liquidationPrice: 0,
            now: dateTimeNow(),
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
    collateral: collateralAddress,
    exchange: exchangeAddress,
    token: oTokenAddress,
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
