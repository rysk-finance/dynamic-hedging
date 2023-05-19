import type { Addresses } from "../../Shared/types";
import type { PositionDataState } from "../types";

import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAccount } from "wagmi";

import { BigNumber } from "ethers";
import { BIG_NUMBER_DECIMALS } from "src/config/constants";
import { useGlobalContext } from "src/state/GlobalContext";
import { optionSymbolFromOToken } from "src/utils";
import {
  fromOpyn,
  fromWeiToInt,
  renameOtoken,
  tFormatEth,
  tFormatUSDC,
  toRysk,
} from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { useAllowance } from "../../Shared/hooks/useAllowance";
import { getQuote } from "../../Shared/utils/getQuote";

export const useShortPositionData = (amountToClose: string) => {
  // URL query params.
  const [searchParams] = useSearchParams();

  // Context state.
  const {
    state: {
      balances,
      ethPrice,
      options: { activeExpiry, userPositions },
    },
  } = useGlobalContext();

  // Addresses.
  const { address } = useAccount();
  const USDCAddress = getContractAddress("USDC");
  const tokenAddress = (searchParams.get("token") as HexString) || undefined;
  const exchangeAddress = getContractAddress("optionExchange");

  const [loading, setLoading] = useState(false);

  // User position state.
  const [positionData, setPositionData] = useState<PositionDataState>({
    acceptablePremium: BigNumber.from(0),
    collateralToRemove: BigNumber.from(0),
    fee: 0,
    hasRequiredCapital: false,
    now: dayjs().format("MMM DD, YYYY HH:mm A"),
    premium: 0,
    quote: 0,
    remainingBalance: 0,
    remainingCollateral: 0,
    slippage: 0,
    totalSize: 0,
    title: null,
    requiredApproval: "",
  });

  const userPosition =
    activeExpiry && userPositions
      ? userPositions[activeExpiry]?.tokens.find(
          ({ id, netAmount }) =>
            id === searchParams.get("token") && BigNumber.from(netAmount).lt(0)
        )
      : undefined;

  const vault = userPosition?.vault;
  const vaultId = vault?.vaultId;

  // At the moment this is either going to be USDC or WETH.
  const collateralAsset = vault?.collateralAsset.id as HexString | undefined;

  // User allowance state for usdc.
  const [allowance, setAllowance] = useAllowance(USDCAddress, address);

  // Get user position data.
  useEffect(() => {
    const setPriceData = async (amount: number) => {
      setLoading(true);

      try {
        if (activeExpiry && tokenAddress && userPosition) {
          const now = dayjs().format("MMM DD, YYYY HH:mm A");

          const totalSize = fromWeiToInt(userPosition?.netAmount || 0);
          const title = `${
            userPosition?.symbol
              ? renameOtoken(userPosition?.symbol || "")
              : optionSymbolFromOToken(
                  userPosition?.isPut || false,
                  userPosition?.expiryTimestamp || "0",
                  userPosition?.strikePrice.toString() || "0"
                )
          } (${totalSize})`.toUpperCase();

          if (amount > 0 && userPosition) {
            const { acceptablePremium, fee, premium, quote, slippage } =
              await getQuote(
                Number(activeExpiry),
                toRysk(fromOpyn(userPosition.strikePrice)),
                userPosition.isPut,
                amount,
                false,
                collateralAsset === getContractAddress("USDC").toLowerCase()
                  ? "USDC"
                  : "WETH"
              );

            // Closing a short is buying back the oToken, hence the minus USDC.
            const remainingBalance =
              balances.USDC === 0 ? 0 : balances.USDC - quote;

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
              .mul(amount * 100)
              .div(100);
            const remainingCollateral = collateralToRemove.isZero()
              ? 0
              : collateralAsset === getContractAddress("WETH")
              ? tFormatEth(collateralAmount.sub(collateralToRemove))
              : tFormatUSDC(collateralAmount.sub(collateralToRemove));

            // Ensure user has sufficient wallet balance to cover premium before collateral is released.
            const hasRequiredCapital = balances.USDC > quote;

            const requiredApproval = String(tFormatUSDC(acceptablePremium, 4));
            const approved = collateralToRemove.lte(allowance.amount);

            setPositionData({
              acceptablePremium,
              collateralToRemove,
              fee,
              hasRequiredCapital,
              now,
              premium,
              quote,
              remainingBalance,
              remainingCollateral,
              slippage,
              totalSize,
              title,
              requiredApproval,
            });
            setAllowance((currentState) => ({ ...currentState, approved }));
          } else {
            setPositionData({
              acceptablePremium: BigNumber.from(0),
              collateralToRemove: BigNumber.from(0),
              fee: 0,
              hasRequiredCapital: false,
              now,
              premium: 0,
              quote: 0,
              remainingBalance: balances.USDC,
              remainingCollateral: 0,
              slippage: 0,
              totalSize,
              title,
              requiredApproval: "",
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
  }, [activeExpiry, amountToClose, ethPrice, tokenAddress, userPositions]);

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
    loading,
  ] as const;
};
