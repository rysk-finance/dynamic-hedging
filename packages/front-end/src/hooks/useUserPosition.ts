import { BigNumber } from "ethers";
import { useCallback } from "react";
import { useAccount, useNetwork } from "wagmi";
import { readContract, readContracts } from "@wagmi/core";

import { LiquidityPoolABI } from "src/abis/LiquidityPool_ABI";
import { BIG_NUMBER_DECIMALS } from "../config/constants";
import { useGlobalContext } from "../state/GlobalContext";
import { ActionType, GlobalState } from "../state/types";
import { DepositReceipt, WithdrawalReceipt } from "../types";
import { getContractAddress } from "src/utils/helpers";

export const useUserPosition = () => {
  const { address } = useAccount();
  const { chain } = useNetwork();

  const liquidityPoolContract = {
    address: getContractAddress("liquidityPool"),
    abi: LiquidityPoolABI,
  } as const;

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
      latestWithdrawalSharePrice: BigNumber
    ) => {
      let receiptUSDCValue = BigNumber.from(0);

      let receiptEpochSharePrice: BigNumber | null = null;

      // still to be processed deposit epoch
      if (
        currentDepositEpoch &&
        receipt &&
        currentDepositEpoch.eq(receipt.epoch)
      ) {
        receiptEpochSharePrice = latestWithdrawalSharePrice;
        // amount of the deposit
        receiptUSDCValue = receiptUSDCValue.add(receipt.amount);
        setPositionBreakdown({
          usdcOnHold: receipt.amount, // waiting to be deposited
          unredeemedShares: receipt.unredeemedShares,
        });
      } else if (receipt) {
        const [withdrawPPS, depositEpochSharePrice] = await readContracts({
          contracts: [
            {
              ...liquidityPoolContract,
              functionName: "withdrawalEpochPricePerShare",
              args: [receipt.epoch],
            },
            {
              ...liquidityPoolContract,
              functionName: "depositEpochPricePerShare",
              args: [receipt.epoch],
            },
          ],
        });

        receiptEpochSharePrice = withdrawPPS;
        // If the receipt epoch was executed, but the user hasn't redeemed or deposited since,
        // we need to calculate the latest usdc value of the "amount" field
        // at the current epoch, with the withdraw epoch share price.
        // TODO(HC): Clear up / label decimals here. Also make a function for operating on numbers
        // with different decimals.
        // e6
        const amountInShares = receipt.amount
          .mul(BIG_NUMBER_DECIMALS.RYSK)
          .div(depositEpochSharePrice); // deposit epoch share price for current receipt epoch
        // e6
        const sharesCurrentValue = amountInShares
          .mul(latestWithdrawalSharePrice) // withdrawal epoch share price for receipt epoch - 1
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
        const unredeemedSharesValue = receipt.unredeemedShares // unredeemedShares is total of all shares besides last receipt amount
          .mul(latestWithdrawalSharePrice)
          .div(BIG_NUMBER_DECIMALS.RYSK)
          .div(BIG_NUMBER_DECIMALS.RYSK.div(BIG_NUMBER_DECIMALS.USDC));

        receiptUSDCValue = receiptUSDCValue.add(unredeemedSharesValue);
      }

      return receiptUSDCValue;
    },
    [setPositionBreakdown]
  );

  const parseWithdrawalReceipt = useCallback(
    async (
      withdrawalReceipt: WithdrawalReceipt,
      currentWithdrawalEpoch: BigNumber = BigNumber.from(1),
      latestWithdrawalSharePrice: BigNumber
    ) => {
      if (
        currentWithdrawalEpoch &&
        withdrawalReceipt &&
        currentWithdrawalEpoch._hex === withdrawalReceipt.epoch._hex
      ) {
        setPositionBreakdown({
          pendingWithdrawShares: {
            amount: withdrawalReceipt.shares,
            epochPrice: latestWithdrawalSharePrice,
          },
        });

        return withdrawalReceipt.shares
          .mul(latestWithdrawalSharePrice)
          .div(BIG_NUMBER_DECIMALS.RYSK)
          .div(BIG_NUMBER_DECIMALS.RYSK.div(BIG_NUMBER_DECIMALS.USDC));
      } else if (withdrawalReceipt) {
        const epochSharePrice = await readContract({
          ...liquidityPoolContract,
          functionName: "withdrawalEpochPricePerShare",
          args: [withdrawalReceipt.epoch],
        });
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
      } else {
        return BigNumber.from(0);
      }
    },
    [setPositionBreakdown]
  );

  const getCurrentPosition = useCallback(
    async (address: HexString) => {
      const [
        balance,
        currentDepositEpoch,
        currentWithdrawalEpoch,
        depositReceipt,
        withdrawalReceipt,
      ] = await readContracts({
        contracts: [
          {
            ...liquidityPoolContract,
            functionName: "balanceOf",
            args: [address],
          },
          {
            ...liquidityPoolContract,
            functionName: "depositEpoch",
          },
          {
            ...liquidityPoolContract,
            functionName: "withdrawalEpoch",
          },
          {
            ...liquidityPoolContract,
            functionName: "depositReceipts",
            args: [address],
          },
          {
            ...liquidityPoolContract,
            functionName: "withdrawalReceipts",
            args: [address],
          },
        ],
      });
      setPositionBreakdown({ redeemedShares: balance });

      const latestWithdrawalSharePrice = await readContract({
        ...liquidityPoolContract,
        functionName: "withdrawalEpochPricePerShare",
        args: [currentWithdrawalEpoch.sub(1)],
      });
      setPositionBreakdown({
        currentWithdrawSharePrice: latestWithdrawalSharePrice,
      });

      const depositReceiptValue = await parseDepositReceipt(
        depositReceipt,
        currentDepositEpoch,
        latestWithdrawalSharePrice
      );
      const withdrawalReceiptValue = await parseWithdrawalReceipt(
        withdrawalReceipt,
        currentWithdrawalEpoch,
        latestWithdrawalSharePrice
      );

      if (balance && !chain?.unsupported) {
        const balanceValue = balance
          .mul(latestWithdrawalSharePrice)
          .div(BIG_NUMBER_DECIMALS.RYSK)
          .div(BIG_NUMBER_DECIMALS.RYSK.div(BIG_NUMBER_DECIMALS.USDC));

        const totalPosition = balanceValue
          .add(depositReceiptValue)
          .add(withdrawalReceiptValue);

        setPositionValue(totalPosition);
      }
    },
    [
      address,
      chain,
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
