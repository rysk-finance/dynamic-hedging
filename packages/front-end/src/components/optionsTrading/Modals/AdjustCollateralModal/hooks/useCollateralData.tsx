import type { Addresses } from "../../Shared/types";
import type { CollateralDataState } from "../types";

import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { useAccount } from "wagmi";

import { getLiquidationPrices } from "src/components/shared/utils/getLiquidationPrice";
import { useGlobalContext } from "src/state/GlobalContext";
import { Convert } from "src/utils/Convert";
import {
  fromWeiToInt,
  tFormatUSDC,
  truncate,
} from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { useAllowance } from "../../Shared/hooks/useAllowance";
import { dateTimeNow, formatExpiry } from "../../Shared/utils/datetime";

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
      options: { activeExpiry, spotShock, timesToExpiry },
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
    callOrPut: adjustingOption?.isPut ? "put" : "call",
    collateral: adjustingOption?.collateralAmount || 0,
    disabled: false,
    expiry: formatExpiry(activeExpiry),
    hasRequiredCapital: true,
    liquidationPrice: adjustingOption?.liquidationPrice || 0,
    now: dateTimeNow(),
    remainingBalanceUSDC: 0,
    remainingBalanceWETH: 0,
    requiredApproval: "",
    strike: adjustingOption?.strike,
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

          const callOrPut = adjustingOption.isPut ? "put" : "call";

          const [liquidationPrice] = await getLiquidationPrices(
            [
              {
                amount: adjustingOption.amount,
                callOrPut,
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
                ? Convert.fromStr(requiredApproval).toUSDC
                : Convert.fromStr(requiredApproval).toWei
              ).lte(allowance.amount)
            : true;

          const disabled =
            (adjustingOption.isPut && liquidationPrice > ethPrice) ||
            (!adjustingOption.isPut && liquidationPrice < ethPrice) ||
            Math.abs(liquidationPrice - ethPrice) < ethPrice * 0.03;

          setCollateralData({
            asset: USDCCollateral ? "USDC" : "WETH",
            callOrPut,
            collateral: newCollateral,
            disabled,
            expiry: formatExpiry(activeExpiry),
            hasRequiredCapital,
            liquidationPrice,
            now: dateTimeNow(),
            remainingBalanceUSDC,
            remainingBalanceWETH,
            requiredApproval,
            strike: adjustingOption.strike,
          });
          setAllowance((currentState) => ({ ...currentState, approved }));
        } else {
          setCollateralData({
            asset: USDCCollateral ? "USDC" : "WETH",
            callOrPut: adjustingOption?.isPut ? "put" : "call",
            collateral: adjustingOption?.collateralAmount || 0,
            disabled: false,
            expiry: formatExpiry(activeExpiry),
            hasRequiredCapital: true,
            liquidationPrice: adjustingOption?.liquidationPrice || 0,
            now: dateTimeNow(),
            remainingBalanceUSDC: balanceUSDC,
            remainingBalanceWETH: balanceWETH,
            requiredApproval: "",
            strike: adjustingOption?.strike,
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
