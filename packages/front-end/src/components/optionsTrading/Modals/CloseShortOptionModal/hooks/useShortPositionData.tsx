import type { Addresses } from "../../Shared/types";
import type { PositionDataState } from "../types";

import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAccount } from "wagmi";

import { useGlobalContext } from "src/state/GlobalContext";
import {
  fromOpyn,
  fromWeiToInt,
  renameOtoken,
  tFormatUSDC,
  toOpyn,
  toRysk,
} from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { useAllowance } from "../../Shared/hooks/useAllowance";
import { BigNumber } from "ethers";
import { BIG_NUMBER_DECIMALS, ZERO_ADDRESS } from "src/config/constants";
import { getQuote } from "../../Shared/utils/getQuote";
import { fetchBalance } from "@wagmi/core";
import { logError } from "src/utils/logError";

export const useShortPositionData = (amountToClose: string) => {
  // URL query params.
  const [searchParams] = useSearchParams();

  // Context state.
  const {
    state: {
      ethPrice,
      options: { activeExpiry, data, userPositions },
    },
  } = useGlobalContext();

  // Addresses.
  const { address } = useAccount();
  const tokenAddress = (searchParams.get("token") as HexString) || undefined;
  const exchangeAddress = getContractAddress("optionExchange");

  const [loading, setLoading] = useState(false);

  // User position state.
  const [positionData, setPositionData] = useState<PositionDataState>({
    acceptablePremium: BigNumber.from(0),
    fee: 0,
    now: dayjs().format("MMM DD, YYYY HH:mm A"),
    premium: 0,
    quote: 0,
    remainingBalance: 0,
    slippage: 0,
    totalSize: 0,
    title: null,
  });

  const userPosition =
    activeExpiry && userPositions
      ? userPositions[activeExpiry]?.tokens.find(
          ({ id, netAmount }) =>
            id === searchParams.get("token") && BigNumber.from(netAmount).lt(0)
        )
      : undefined;

  const vault = userPosition?.vault;

  // At the moment this is either going to be USDC or WETH.
  const collateralAsset = vault?.collateralAsset.id as HexString;

  // User allowance state for the oToken.
  const [allowance, setAllowance] = useAllowance(collateralAsset);

  // Get user position data.
  useEffect(() => {
    const setPriceData = async (amount: number) => {
      setLoading(true);
      try {
        const { value: balance } = await fetchBalance({
          address: address || ZERO_ADDRESS,
          token: getContractAddress("USDC"),
        });
        const balanceInt = tFormatUSDC(balance);

        if (activeExpiry && tokenAddress && userPosition) {
          const now = dayjs().format("MMM DD, YYYY HH:mm A");

          const totalSize = fromWeiToInt(userPosition?.netAmount || 0);
          const title = `${renameOtoken(
            userPosition?.symbol || ""
          )} (${totalSize})`.toUpperCase();

          if (amount > 0 && userPosition) {
            const { acceptablePremium, fee, premium, quote, slippage } =
              await getQuote(
                Number(activeExpiry),
                toRysk(fromOpyn(userPosition.strikePrice)),
                userPosition.isPut,
                amount,
                false,
                collateralAsset === getContractAddress("USDC") ? "USDC" : "WETH"
              );

            // closing a short is buying back the oToken, hence the minus USDC.
            const remainingBalance = balance.isZero() ? 0 : balanceInt - quote;
            const approved = toOpyn(amountToClose).lte(allowance.amount);

            setPositionData({
              acceptablePremium,
              fee,
              now,
              premium,
              quote,
              remainingBalance,
              slippage,
              totalSize,
              title,
            });
          } else {
            setPositionData({
              acceptablePremium: BigNumber.from(0),
              fee: 0,
              now,
              premium: 0,
              quote: 0,
              remainingBalance: balanceInt,
              slippage: 0,
              totalSize,
              title,
            });
          }
        }

        setLoading(false);
      } catch (error) {
        logError(error);
        setLoading(false);
      }
    };

    // if no amount we only need data below (for adjusting collateral)
    if (amountToClose) {
      setPriceData(Number(amountToClose));
    }
  }, [activeExpiry, amountToClose, ethPrice, tokenAddress, userPositions]);

  const addresses: Addresses = {
    exchange: exchangeAddress,
    collateral: collateralAsset,
    token: tokenAddress,
    user: address,
  };

  const collateralAmount = BigNumber.from(vault?.collateralAmount || "1");
  const shortAmount = BigNumber.from(vault?.shortAmount || "0");

  const vaultId = vault?.vaultId;

  const collateralPerOption =
    !collateralAmount.isZero() && !shortAmount.isZero()
      ? collateralAmount.mul(BIG_NUMBER_DECIMALS.OPYN).div(shortAmount)
      : BigNumber.from(0);

  return [
    addresses,
    allowance,
    setAllowance,
    positionData,
    collateralAmount,
    collateralPerOption,
    collateralAsset,
    vaultId,
  ] as const;
};
