import React, { useEffect, useState } from "react";
import { useContract } from "../hooks/useContract";
import LPABI from "../abis/LiquidityPool.json";
import { gql, useQuery } from "@apollo/client";
import { useWalletContext } from "../App";
import { BigNumber } from "ethers";
import { DepositReceipt } from "../types";
import { BIG_NUMBER_DECIMALS } from "../config/constants";
import NumberFormat from "react-number-format";
import { RequiresWalletConnection } from "./RequiresWalletConnection";

export const UserPosition = () => {
  const { account } = useWalletContext();

  const [currentRedeemedPosition, setCurrentRedeemedPosition] =
    useState<BigNumber | null>(null);
  const [unredeemableCollateral, setUnredeemableCollateral] =
    useState<BigNumber | null>(null);
  const [unredeemedSharesValue, setUnredeemedSharesValue] =
    useState<BigNumber | null>(null);

  const [lpContract] = useContract({
    contract: "liquidityPool",
    ABI: LPABI,
    readOnly: true,
  });

  useEffect(() => {
    const getCurrentPosition = async (address: string) => {
      const balance = await lpContract?.balanceOf(address);
      const epoch = await lpContract?.epoch();
      // TODO if makes sense to have the latest available epoch as -1
      const pricePerShareAtEpoch = await lpContract?.epochPricePerShare(
        epoch - 1
      );

      // converting to 1e6 - usdc for easy comparison
      const positionValue =
        balance.gt(0) && pricePerShareAtEpoch?.gt(0)
          ? balance.mul(pricePerShareAtEpoch).div(BigNumber.from(10).pow(30))
          : BigNumber.from(0);

      setCurrentRedeemedPosition(positionValue);

      const depositReceipt: DepositReceipt = await lpContract?.depositReceipts(
        account
      );
      const currentEpoch: BigNumber = await lpContract?.epoch();
      const previousUnredeemedShares = depositReceipt.unredeemedShares;
      const unredeemedShares = BigNumber.from(0);
      // If true, the share price for the most recent deposit hasn't been calculated
      // so we can only show the collateral balance, not the equivalent number of shares.
      if (currentEpoch._hex === depositReceipt.epoch._hex) {
        unredeemedShares.add(previousUnredeemedShares);
        if (depositReceipt.amount.toNumber() !== 0) {
          setUnredeemableCollateral(depositReceipt.amount);
        }
      } else {
        const pricePerShareAtEpoch: BigNumber =
          await lpContract?.epochPricePerShare(depositReceipt.epoch);
        // TODO(HC): Price oracle is returning 1*10^18 for price so having to adjust price
        // whilst building out to avoid share numbers being too small. Once price oracle is returning
        // more accurate
        const newUnredeemedShares = depositReceipt.amount
          .div(BIG_NUMBER_DECIMALS.USDC)
          .mul(BIG_NUMBER_DECIMALS.RYSK)
          .div(pricePerShareAtEpoch)
          .mul(BIG_NUMBER_DECIMALS.RYSK);
        const sharesToRedeem =
          previousUnredeemedShares.add(newUnredeemedShares);
        unredeemedShares.add(sharesToRedeem);

        const unredeemedSharesValue = sharesToRedeem
          .mul(pricePerShareAtEpoch)
          .div(BigNumber.from(10).pow(30));

        setUnredeemedSharesValue(unredeemedSharesValue);
      }
    };

    (async () => {
      if (account && lpContract) {
        await getCurrentPosition(account);
      }
    })();
  }, [account, lpContract]);

  return (
    <RequiresWalletConnection className="h-8 w-32">
      <h4>
        <b>
          Total Position:{" "}
          {
            <NumberFormat
              value={Number(
                BigNumber.from(0)
                  .add(currentRedeemedPosition ?? 0)
                  ?.add(unredeemableCollateral ?? 0)
                  .add(unredeemedSharesValue ?? 0)
                  .toNumber() / 1e6
              )}
              displayType={"text"}
              decimalScale={2}
            />
          }{" "}
          DHV USDC
        </b>
      </h4>
    </RequiresWalletConnection>
  );
};
