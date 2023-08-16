import type { Addresses } from "../../Shared/types";
import type { CollateralDataState } from "../types";

import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { useAccount } from "wagmi";

import { getLiquidationPrices } from "src/components/shared/utils/getLiquidationPrice";
import { useGlobalContext } from "src/state/GlobalContext";
import {
  fromWeiToInt,
  tFormatUSDC,
  toUSDC,
  toWei,
  truncate,
} from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { useAllowance } from "../../Shared/hooks/useAllowance";

export const useCollateralData = (
  amountToAdjust: string,
  isDepositing: boolean
) => {
  // Global state.
  const {
    state: {
      adjustingOption,
      balances,
      ethPrice,
      options: { spotShock, timesToExpiry },
    },
  } = useGlobalContext();

  // Addresses.
  const { address } = useAccount();
  const exchangeAddress = getContractAddress("optionExchange");
  const collateralAddress = adjustingOption?.vault.collateralAsset.id;

  // User allowance state for the collateral asset.
  const [allowance, setAllowance] = useAllowance(collateralAddress, address);

  // User position state.
  const [collateralData, setCollateralData] = useState<CollateralDataState>({
    asset: "USDC",
    collateral: adjustingOption?.collateralAmount || 0,
    disabled: false,
    hasRequiredCapital: true,
    liquidationPrice: adjustingOption?.liquidationPrice || 0,
    now: dayjs().format("MMM DD, YYYY HH:mm A"),
    remainingBalanceUSDC: 0,
    remainingBalanceWETH: 0,
    requiredApproval: "",
    series: "",
  });

  const [loading, setLoading] = useState(false);
  const [debouncedLoading] = useDebounce(loading, 300);

  // Get user position collateral data.
  useEffect(() => {
    const getCollateralData = async (amount: number) => {
      setLoading(true);

      try {
        const { USDC: balanceUSDC, WETH: balanceWETH } = balances;
        const USDCCollateral = adjustingOption?.asset === "USDC";

        if (amount > 0 && ethPrice && adjustingOption && collateralAddress) {
          const currentCollateral = USDCCollateral
            ? tFormatUSDC(adjustingOption.vault.collateralAmount)
            : fromWeiToInt(adjustingOption.vault.collateralAmount);
          const newCollateral = isDepositing
            ? currentCollateral + amount
            : currentCollateral - amount;

          const [liquidationPrice] = await getLiquidationPrices(
            [
              {
                amount: adjustingOption.amount,
                callOrPut: adjustingOption.isPut ? "put" : "call",
                collateral: newCollateral,
                collateralAddress,
                expiry: Number(adjustingOption.expiryTimestamp),
                strikePrice: adjustingOption.strike,
              },
            ],
            ethPrice,
            spotShock,
            timesToExpiry
          );

          const remainingBalanceUSDC = USDCCollateral
            ? isDepositing
              ? balanceUSDC - amount
              : balanceUSDC + amount
            : balanceUSDC;
          const remainingBalanceWETH = USDCCollateral
            ? balanceWETH
            : isDepositing
            ? balanceWETH - amount
            : balanceWETH + amount;

          const approvalBuffer = 1.005;
          // Ensure user has sufficient wallet balance to cover collateral + buffer.
          const hasRequiredCapital = isDepositing
            ? USDCCollateral
              ? balanceUSDC > amount * approvalBuffer
              : balanceWETH > amount * approvalBuffer
            : true;

          const requiredApproval = String(truncate(amount * approvalBuffer, 4));
          const approved = isDepositing
            ? (USDCCollateral
                ? toUSDC(requiredApproval)
                : toWei(requiredApproval)
              ).lte(allowance.amount)
            : true;

          const disabled =
            (adjustingOption.isPut && liquidationPrice > ethPrice) ||
            (!adjustingOption.isPut && liquidationPrice < ethPrice) ||
            Math.abs(liquidationPrice - ethPrice) < ethPrice * 0.03;

          setCollateralData({
            asset: USDCCollateral ? "USDC" : "WETH",
            collateral: newCollateral,
            disabled,
            hasRequiredCapital,
            liquidationPrice,
            now: dayjs().format("MMM DD, YYYY HH:mm A"),
            remainingBalanceUSDC,
            remainingBalanceWETH,
            requiredApproval,
            series: adjustingOption.series,
          });
          setAllowance((currentState) => ({ ...currentState, approved }));
        } else {
          setCollateralData({
            asset: USDCCollateral ? "USDC" : "WETH",
            collateral: adjustingOption?.collateralAmount || 0,
            disabled: false,
            hasRequiredCapital: true,
            liquidationPrice: adjustingOption?.liquidationPrice || 0,
            now: dayjs().format("MMM DD, YYYY HH:mm A"),
            remainingBalanceUSDC: balanceUSDC,
            remainingBalanceWETH: balanceWETH,
            requiredApproval: "",
            series: adjustingOption?.series,
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

    getCollateralData(Number(amountToAdjust));
  }, [amountToAdjust, allowance.amount, ethPrice, isDepositing]);

  const addresses: Addresses = {
    exchange: exchangeAddress,
    collateral: collateralAddress,
    token: collateralAddress,
    user: address,
  };

  return [
    addresses,
    allowance,
    setAllowance,
    collateralData,
    debouncedLoading,
  ] as const;
};
