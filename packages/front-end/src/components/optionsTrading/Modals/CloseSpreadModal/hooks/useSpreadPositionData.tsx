import type { SpreadAddresses } from "../../Shared/types";
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

export const useSpreadPositionData = (amountToClose: string) => {
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
  const shortOTokenAddress = closingOption?.address;
  const longOTokenAddress = closingOption?.longCollateralAddress;
  const USDCAddress = getContractAddress("USDC");
  const exchangeAddress = getContractAddress("optionExchange");
  const marginPoolAddress = getContractAddress("marginPool");

  // User allowance state for USDC & long oToken.
  const [allowanceUSDC, setAllowanceUSDC] = useAllowance(USDCAddress, address);
  const [allowanceOToken, setAllowanceOToken] = useAllowance(
    longOTokenAddress,
    address,
    marginPoolAddress
  );

  // Vault data.
  const vault = closingOption?.vault;
  const vaultId = vault?.vaultId;
  const isCredit = Boolean(vault?.longCollateral && vault?.collateralAmount);

  // User position state.
  const [positionData, setPositionData] = useState<PositionDataState>({
    acceptablePremium: [BigNumber.from(0), BigNumber.from(0)],
    callOrPut: closingOption?.isPut ? "put" : "call",
    collateralReleased: 0,
    collateralToRemove: BigNumber.from(0),
    collateralType: "USDC",
    expiry: formatExpiry(activeExpiry),
    exposure: 0,
    fee: 0,
    hasRequiredCapital: false,
    isCredit,
    isPut: Boolean(closingOption?.isPut),
    now: dateTimeNow(),
    operation: "sell",
    premiums: [0, 0],
    quotes: [0, 0],
    remainingBalance: 0,
    remainingCollateral: 0,
    requiredApproval: "",
    slippage: 0,
    strikes: closingOption?.strikes,
    totalSize: 0,
  });

  const [loading, setLoading] = useState(false);
  const [debouncedLoading] = useDebounce(loading, 300);

  // Get user position data.
  useEffect(() => {
    const setPriceData = async (amount: number) => {
      setLoading(true);

      try {
        if (
          activeExpiry &&
          shortOTokenAddress &&
          longOTokenAddress &&
          closingOption
        ) {
          const convertShort = Convert.fromStr(closingOption.strikes[0]);
          const convertLong = Convert.fromStr(closingOption.strikes[1]);
          const now = dateTimeNow();
          const totalSize = closingOption.amount;

          if (amount > 0) {
            const [shortQuote, longQuote] = await getQuotes([
              {
                expiry: Number(activeExpiry),
                strike: convertShort.toWei(),
                isPut: closingOption.isPut,
                orderSize: amount,
                isSell: false,
                collateral: "USDC",
              },
              {
                expiry: Number(activeExpiry),
                strike: convertLong.toWei(),
                isPut: closingOption.isPut,
                orderSize: amount,
                isSell: true,
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
              : Convert.fromUSDC(
                  collateralAmount.sub(collateralToRemove),
                  2
                ).toInt();
            const collateralReleased = Convert.fromUSDC(
              collateralToRemove,
              2
            ).toInt();

            // Balance minus cost to close short plus premium from selling long and collateral released.
            const remainingBalance =
              balances.USDC === 0
                ? 0
                : balances.USDC -
                  shortQuote.quote +
                  longQuote.quote +
                  collateralReleased;

            // Ensure user has sufficient wallet balance to cover premium before collateral is released.
            const hasRequiredCapital = balances.USDC > shortQuote.quote;

            const requiredApproval = Convert.fromUSDC(
              shortQuote.acceptablePremium
            ).toStr();
            const approvedUSDC = shortQuote.acceptablePremium.lte(
              allowanceUSDC.amount
            );
            const approvedOToken = Convert.fromInt(amount)
              .toOpyn()
              .lte(allowanceOToken.amount);

            setPositionData({
              acceptablePremium: [
                shortQuote.acceptablePremium,
                longQuote.acceptablePremium,
              ],
              callOrPut: closingOption.isPut ? "put" : "call",
              collateralReleased,
              collateralToRemove,
              collateralType: "USDC",
              expiry: formatExpiry(activeExpiry),
              exposure: closingOption.shortUSDCExposure || 0,
              fee: shortQuote.fee + longQuote.fee,
              hasRequiredCapital,
              isCredit,
              isPut: closingOption.isPut,
              now,
              operation: closingOption?.shortUSDCExposure ? "close" : "sell",
              premiums: [shortQuote.premium, longQuote.premium],
              quotes: [shortQuote.quote, longQuote.quote],
              remainingBalance,
              remainingCollateral,
              requiredApproval,
              slippage: shortQuote.slippage - longQuote.slippage,
              strikes: closingOption.strikes,
              totalSize: Math.abs(totalSize),
            });
            setAllowanceUSDC((currentState) => ({
              ...currentState,
              approved: approvedUSDC,
            }));
            setAllowanceOToken((currentState) => ({
              ...currentState,
              approved: approvedOToken,
            }));
          } else {
            setPositionData({
              acceptablePremium: [BigNumber.from(0), BigNumber.from(0)],
              callOrPut: closingOption?.isPut ? "put" : "call",
              collateralReleased: 0,
              collateralToRemove: BigNumber.from(0),
              collateralType: "USDC",
              expiry: formatExpiry(activeExpiry),
              exposure: 0,
              fee: 0,
              hasRequiredCapital: false,
              isCredit,
              isPut: closingOption.isPut,
              now,
              operation: "sell",
              premiums: [0, 0],
              quotes: [0, 0],
              remainingBalance: balances.USDC,
              remainingCollateral: 0,
              requiredApproval: "",
              slippage: 0,
              strikes: closingOption.strikes,
              totalSize: Math.abs(totalSize),
            });
            setAllowanceUSDC((currentState) => ({
              ...currentState,
              approved: false,
            }));
            setAllowanceOToken((currentState) => ({
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
  }, [
    activeExpiry,
    amountToClose,
    closingOption,
    ethPrice,
    shortOTokenAddress,
    longOTokenAddress,
  ]);

  const addresses: SpreadAddresses = {
    collateral: USDCAddress,
    exchange: exchangeAddress,
    marginPool: marginPoolAddress,
    tokens: [shortOTokenAddress, longOTokenAddress],
    user: address,
  };

  return [
    addresses,
    allowanceUSDC.approved,
    allowanceOToken.approved,
    setAllowanceUSDC,
    setAllowanceOToken,
    positionData,
    vaultId,
    debouncedLoading,
  ] as const;
};
