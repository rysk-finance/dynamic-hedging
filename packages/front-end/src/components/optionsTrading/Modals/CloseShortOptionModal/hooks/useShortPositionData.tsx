import type { Addresses } from "../../Shared/types";
import type { PositionDataState } from "../types";

import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { useAccount } from "wagmi";

import { BigNumber } from "ethers";
import { getQuotes } from "src/components/shared/utils/getQuote";
import { BIG_NUMBER_DECIMALS } from "src/config/constants";
import { useGlobalContext } from "src/state/GlobalContext";
import { Convert } from "src/utils/Convert";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { useAllowance } from "../../Shared/hooks/useAllowance";
import { dateTimeNow, formatExpiry } from "../../Shared/utils/datetime";

export const useShortPositionData = (amountToClose: string) => {
  // Context state.
  const {
    state: {
      balances,
      closingOption,
      ethPrice,
      options: { activeExpiry },
    },
  } = useGlobalContext();

  // Addresses.
  const { address } = useAccount();
  const USDCAddress = getContractAddress("USDC");
  const tokenAddress = closingOption?.address || undefined;
  const exchangeAddress = getContractAddress("optionExchange");

  const [loading, setLoading] = useState(false);
  const [debouncedLoading] = useDebounce(loading, 300);

  // User position state.
  const [positionData, setPositionData] = useState<PositionDataState>({
    acceptablePremium: BigNumber.from(0),
    callOrPut: closingOption?.isPut ? "put" : "call",
    collateralReleased: 0,
    collateralToRemove: BigNumber.from(0),
    collateralType: undefined,
    expiry: formatExpiry(activeExpiry),
    fee: 0,
    hasRequiredCapital: false,
    now: dateTimeNow(),
    premium: 0,
    quote: 0,
    remainingBalanceUSDC: 0,
    remainingBalanceWETH: 0,
    remainingCollateral: 0,
    slippage: 0,
    totalSize: 0,
    requiredApproval: "",
    strike: closingOption?.strikes
      ? Convert.fromStr(closingOption.strikes[0]).toInt()
      : undefined,
  });

  const vault = closingOption?.vault;
  const vaultId = vault?.vaultId;

  // At the moment this is either going to be USDC or WETH.
  const collateralAsset = vault?.collateralAsset.id as HexString | undefined;
  const collateralType = !collateralAsset
    ? undefined
    : collateralAsset === getContractAddress("USDC").toLowerCase()
    ? "USDC"
    : "WETH";

  // User allowance state for usdc.
  const [allowance, setAllowance] = useAllowance(USDCAddress, address);

  // Get user position data.
  useEffect(() => {
    const setPriceData = async (amount: number) => {
      setLoading(true);

      try {
        if (activeExpiry && tokenAddress && closingOption) {
          const now = dateTimeNow();

          const totalSize = closingOption.amount;
          const title = closingOption.series;

          if (amount > 0) {
            const [{ acceptablePremium, fee, premium, quote, slippage }] =
              await getQuotes([
                {
                  expiry: Number(activeExpiry),
                  strike: Convert.fromStr(closingOption.strikes[0]).toWei(),
                  isPut: closingOption.isPut,
                  orderSize: amount,
                  isSell: false,
                  collateral: collateralType,
                },
              ]);

            // Calculate collateral to remove and remaining collateral.
            const collateralAmount = BigNumber.from(
              vault?.collateralAmount || "1"
            );
            const shortAmount = BigNumber.from(vault?.shortAmount || "0");

            const collateralPerOption =
              !collateralAmount.isZero() && !shortAmount.isZero()
                ? collateralAmount
                    .mul(BIG_NUMBER_DECIMALS.OPYN)
                    .div(shortAmount)
                : BigNumber.from(0);

            const collateralToRemove = collateralPerOption
              .mul(Math.round(amount * 100))
              .div(100);
            const remainingCollateral = collateralToRemove.isZero()
              ? 0
              : collateralAsset === getContractAddress("WETH")
              ? Convert.fromWei(
                  collateralAmount.sub(collateralToRemove),
                  4
                ).toInt()
              : Convert.fromUSDC(
                  collateralAmount.sub(collateralToRemove),
                  2
                ).toInt();
            const collateralReleased =
              collateralAsset === getContractAddress("WETH")
                ? Convert.fromWei(collateralToRemove, 4).toInt()
                : Convert.fromUSDC(collateralToRemove, 2).toInt();

            // Closing a short is buying back the oToken, hence minus the quote.
            const remainingBalanceUSDC =
              balances.USDC === 0
                ? 0
                : balances.USDC - quote + collateralReleased;
            // Show WETH balance when closing part of a WETH collateralised position.
            const remainingBalanceWETH =
              collateralAsset === getContractAddress("WETH")
                ? balances.WETH + collateralReleased
                : balances.WETH;

            // Ensure user has sufficient wallet balance to cover premium before collateral is released.
            const hasRequiredCapital = balances.USDC > quote;

            const requiredApproval =
              Convert.fromUSDC(acceptablePremium).toStr();
            const approved = acceptablePremium.lte(allowance.amount);

            setPositionData({
              acceptablePremium,
              callOrPut: closingOption.isPut ? "put" : "call",
              collateralReleased,
              collateralToRemove,
              collateralType,
              expiry: formatExpiry(activeExpiry),
              fee,
              hasRequiredCapital,
              now,
              premium,
              quote,
              remainingBalanceUSDC,
              remainingBalanceWETH,
              remainingCollateral,
              slippage,
              totalSize: Math.abs(totalSize),
              requiredApproval,
              strike: Convert.fromStr(closingOption.strikes[0]).toInt(),
            });
            setAllowance((currentState) => ({ ...currentState, approved }));
          } else {
            setPositionData({
              acceptablePremium: BigNumber.from(0),
              callOrPut: closingOption?.isPut ? "put" : "call",
              collateralReleased: 0,
              collateralToRemove: BigNumber.from(0),
              collateralType,
              expiry: formatExpiry(activeExpiry),
              fee: 0,
              hasRequiredCapital: false,
              now,
              premium: 0,
              quote: 0,
              remainingBalanceUSDC: balances.USDC,
              remainingBalanceWETH: balances.WETH,
              remainingCollateral: 0,
              slippage: 0,
              totalSize: Math.abs(totalSize),
              requiredApproval: "",
              strike: closingOption?.strikes
                ? Convert.fromStr(closingOption.strikes[0]).toInt()
                : undefined,
            });
            setAllowance((currentState) => ({
              ...currentState,
              approved: false,
            }));
          }
        }

        setLoading(false);
      } catch (error) {
        logError(error);
        setLoading(false);
      }
    };

    setPriceData(Number(amountToClose));
  }, [activeExpiry, amountToClose, closingOption, ethPrice, tokenAddress]);

  const addresses: Addresses = {
    exchange: exchangeAddress,
    collateral: collateralAsset,
    token: tokenAddress,
    user: address,
  };

  return [
    addresses,
    allowance,
    setAllowance,
    positionData,
    vaultId,
    debouncedLoading,
  ] as const;
};
