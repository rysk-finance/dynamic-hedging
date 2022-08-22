import React, { useCallback, useEffect, useState } from "react";
import { useContract } from "./useContract";
import LPABI from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json";
import { BigNumber } from "ethers";
import { useWalletContext } from "../App";
import { BIG_NUMBER_DECIMALS } from "../config/constants";
import { DepositReceipt, WithdrawalReceipt } from "../types";
import { useGlobalContext } from "../state/GlobalContext";
import { ActionType } from "../state/types";

export const useUserPosition = () => {
  const { account } = useWalletContext();

  const [lpContract] = useContract({
    contract: "liquidityPool",
    ABI: LPABI.abi,
    readOnly: true,
  });

  const {
    dispatch,
    state: { userPositionValue },
  } = useGlobalContext();

  const setPositionValue = useCallback(
    (value: BigNumber) => {
      dispatch({ type: ActionType.SET_POSITION_VALUE, value });
    },
    [dispatch]
  );

  const parseDepositReceipt = useCallback(
    async (
      receipt: DepositReceipt,
      currentDepositEpoch: BigNumber,
      currentWithdrawalEpoch: BigNumber
    ) => {
      const latestEpochSharePrice =
        await lpContract?.withdrawalEpochPricePerShare(
          currentWithdrawalEpoch.sub(1)
        );
      let receiptUSDCValue = BigNumber.from(0);

      let receiptEpochSharePrice: BigNumber | null = null;

      if (currentDepositEpoch._hex === receipt.epoch._hex) {
        receiptEpochSharePrice = latestEpochSharePrice;
        receiptUSDCValue = receiptUSDCValue.add(receipt.amount);
      } else {
        receiptEpochSharePrice = await lpContract?.withdrawalEpochPricePerShare(
          receipt.epoch
        );
        const depositEpochSharePrice =
          await lpContract?.depositEpochPricePerShare(receipt.epoch);
        // If the receipt epoch was executed, but the user hasn't redeemed or deposited since,
        // we need to calculate the latest usdc value of the "amount" field
        // at the current epoch, with the withdraw epoch share price.
        // e18
        const amountInShares = receipt.amount
          .mul(BIG_NUMBER_DECIMALS.RYSK)
          .div(depositEpochSharePrice);
        const sharesCurrentValue = amountInShares
          .mul(latestEpochSharePrice)
          .div(BIG_NUMBER_DECIMALS.RYSK);
        receiptUSDCValue = receiptUSDCValue.add(sharesCurrentValue);
      }

      if (receiptEpochSharePrice) {
        const unredeemedSharesValue = receipt.unredeemedShares
          .mul(receiptEpochSharePrice)
          .div(BIG_NUMBER_DECIMALS.RYSK);

        receiptUSDCValue = receiptUSDCValue.add(unredeemedSharesValue);
      }

      return receiptUSDCValue;
    },
    [lpContract]
  );

  const parseWithdrawalReceipt = useCallback(
    async (
      withdrawalReceipt: WithdrawalReceipt,
      currentWithdrawalEpoch: BigNumber
    ) => {
      if (currentWithdrawalEpoch === withdrawalReceipt.epoch) {
        const epochSharePrice = await lpContract?.withdrawalEpochPricePerShare(
          currentWithdrawalEpoch.sub(1)
        );
        return withdrawalReceipt.shares
          .mul(epochSharePrice)
          .div(BIG_NUMBER_DECIMALS.RYSK);
      } else {
        const epochSharePrice = await lpContract?.withdrawalEpochPricePerShare(
          withdrawalReceipt.epoch
        );
        return withdrawalReceipt.shares
          .mul(epochSharePrice)
          .div(BIG_NUMBER_DECIMALS.RYSK)
          .div(BIG_NUMBER_DECIMALS.RYSK.div(BIG_NUMBER_DECIMALS.USDC));
      }
    },
    [lpContract]
  );

  const getCurrentPosition = useCallback(
    async (address: string) => {
      const balance: BigNumber = await lpContract?.balanceOf(address);
      const currentDepositEpoch = await lpContract?.depositEpoch();
      const currentWithdrawalEpoch = await lpContract?.depositEpoch();
      const latestWithdrawalSharePrice =
        await lpContract?.withdrawalEpochPricePerShare(
          currentWithdrawalEpoch.sub(1)
        );
      const balanceValue = balance
        .mul(latestWithdrawalSharePrice)
        .div(BIG_NUMBER_DECIMALS.RYSK)
        .div(BIG_NUMBER_DECIMALS.RYSK.div(BIG_NUMBER_DECIMALS.USDC));

      const depositReceipt: DepositReceipt = await lpContract?.depositReceipts(
        account
      );
      const depositReceiptValue = await parseDepositReceipt(
        depositReceipt,
        currentDepositEpoch,
        currentWithdrawalEpoch
      );
      const withdrawalReceipt: WithdrawalReceipt =
        await lpContract?.withdrawalReceipts(account);
      const withdrawalReceiptValue = await parseWithdrawalReceipt(
        withdrawalReceipt,
        currentWithdrawalEpoch
      );

      const totalPosition = balanceValue
        .add(depositReceiptValue)
        .add(withdrawalReceiptValue);

      setPositionValue(totalPosition);
    },
    [
      account,
      lpContract,
      parseDepositReceipt,
      parseWithdrawalReceipt,
      setPositionValue,
    ]
  );

  useEffect(() => {
    (async () => {
      if (account && lpContract) {
        await getCurrentPosition(account);
      }
    })();
  }, [getCurrentPosition, account, lpContract]);

  return { userPositionValue, updatePosition: getCurrentPosition };
};
