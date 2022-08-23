import React, { useCallback } from "react";
import { useContract } from "./useContract";
import LPABI from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json";
import { BigNumber } from "ethers";
import { useWalletContext } from "../App";
import { BIG_NUMBER_DECIMALS } from "../config/constants";
import { DepositReceipt, WithdrawalReceipt } from "../types";
import { useGlobalContext } from "../state/GlobalContext";
import { ActionType, GlobalState } from "../state/types";

export const useUserPosition = () => {
  const { account } = useWalletContext();

  const [lpContract] = useContract({
    contract: "liquidityPool",
    ABI: LPABI.abi,
    readOnly: true,
  });

  const {
    dispatch,
    state: { userPositionValue, positionBreakdown },
  } = useGlobalContext();

  const setPositionValue = useCallback(
    (value: BigNumber) => {
      dispatch({ type: ActionType.SET_POSITION_VALUE, value });
    },
    [dispatch]
  );

  const setPositionBreakdown = useCallback(
    (values: Partial<GlobalState["positionBreakdown"]>) => {
      dispatch({ type: ActionType.SET_POSITION_BREAKDOWN, values });
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
        setPositionBreakdown({
          usdcOnHold: receipt.amount,
          unredeemedShares: receipt.unredeemedShares,
        });
      } else {
        receiptEpochSharePrice = await lpContract?.withdrawalEpochPricePerShare(
          receipt.epoch
        );
        const depositEpochSharePrice =
          await lpContract?.depositEpochPricePerShare(receipt.epoch);
        // If the receipt epoch was executed, but the user hasn't redeemed or deposited since,
        // we need to calculate the latest usdc value of the "amount" field
        // at the current epoch, with the withdraw epoch share price.
        // TODO(HC): Clear up / label decimals here. Also make a function for operating on numbers
        // with different decimals.
        // e6
        const amountInShares = receipt.amount
          .mul(BIG_NUMBER_DECIMALS.RYSK)
          .div(depositEpochSharePrice);
        // e6
        const sharesCurrentValue = amountInShares
          .mul(latestEpochSharePrice)
          .div(BIG_NUMBER_DECIMALS.RYSK);
        receiptUSDCValue = receiptUSDCValue.add(sharesCurrentValue);

        setPositionBreakdown({
          usdcOnHold: BigNumber.from(0),
          // e18
          unredeemedShares: receipt.unredeemedShares.add(
            amountInShares.mul(
              BIG_NUMBER_DECIMALS.RYSK.div(BIG_NUMBER_DECIMALS.USDC)
            )
          ),
        });
      }

      if (receiptEpochSharePrice) {
        const unredeemedSharesValue = receipt.unredeemedShares
          .mul(receiptEpochSharePrice)
          .div(BIG_NUMBER_DECIMALS.RYSK)
          .div(BIG_NUMBER_DECIMALS.RYSK.div(BIG_NUMBER_DECIMALS.USDC));

        receiptUSDCValue = receiptUSDCValue.add(unredeemedSharesValue);
      }

      return receiptUSDCValue;
    },
    [lpContract, setPositionBreakdown]
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
        setPositionBreakdown({
          pendingWithdrawShares: {
            amount: withdrawalReceipt.shares,
            epochPrice: epochSharePrice,
          },
        });
        return withdrawalReceipt.shares
          .mul(epochSharePrice)
          .div(BIG_NUMBER_DECIMALS.RYSK)
          .div(BIG_NUMBER_DECIMALS.RYSK.div(BIG_NUMBER_DECIMALS.USDC));
      }
    },
    [lpContract, setPositionBreakdown]
  );

  const getCurrentPosition = useCallback(
    async (address: string) => {
      const balance: BigNumber = await lpContract?.balanceOf(address);
      setPositionBreakdown({ redeemedShares: balance });

      const currentDepositEpoch = await lpContract?.depositEpoch();
      const currentWithdrawalEpoch = await lpContract?.depositEpoch();
      const latestWithdrawalSharePrice =
        await lpContract?.withdrawalEpochPricePerShare(
          currentWithdrawalEpoch.sub(1)
        );
      setPositionBreakdown({
        currentWithdrawSharePrice: latestWithdrawalSharePrice,
      });
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
      setPositionBreakdown,
    ]
  );

  return {
    userPositionValue,
    positionBreakdown,
    updatePosition: getCurrentPosition,
  };
};
