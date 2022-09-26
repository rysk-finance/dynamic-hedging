import React from "react";
import { BigNumber } from "ethers";
import { useCallback, useEffect } from "react";
import { toast } from "react-toastify";
import { useWalletContext } from "../../App";
import LPABI from "../../abis/LiquidityPool.json";
import { useContract } from "../../hooks/useContract";
import { VaultActionType } from "../../state/types";
import { useVaultContext } from "../../state/VaultContext";
import { useUserPosition } from "../../hooks/useUserPosition";

export const VaultStateManagment = () => {
  const { account } = useWalletContext();
  const { dispatch } = useVaultContext();
  const { updatePosition } = useUserPosition();

  const [lpContract] = useContract<{
    DepositEpochExecuted: [];
    WithdrawalEpochExecuted: [];
  }>({
    contract: "liquidityPool",
    ABI: LPABI,
    readOnly: true,
    events: {
      DepositEpochExecuted: async () => {
        toast("✅ The deposit epoch was advanced");
        EpochListener();
      },
      WithdrawalEpochExecuted: async () => {
        // Assuming that epochs get advanced separately, we have
        // two separate toast messages. If not we can remove one listener.
        toast("✅ The withdraw epoch was advanced");
        EpochListener();
      },
    },
    isListening: {
      DepositEpochExecuted: true,
      WithdrawalEpochExecuted: true,
    },
  });

  const getEpochData = useCallback(async () => {
    if (lpContract) {
      const depositEpoch: BigNumber = await lpContract.depositEpoch();
      const withdrawalEpoch: BigNumber = await lpContract.withdrawalEpoch();
      const depositEpochPricePerShare: BigNumber =
        await lpContract.depositEpochPricePerShare(depositEpoch.sub(1));
      const withdrawalEpochPricePerShare: BigNumber =
        await lpContract.withdrawalEpochPricePerShare(withdrawalEpoch.sub(1));
      return {
        depositEpoch,
        withdrawalEpoch,
        depositEpochPricePerShare,
        withdrawalEpochPricePerShare,
      };
    }
  }, [lpContract]);

  const EpochListener = useCallback(async () => {
    const epochData = await getEpochData();
    dispatch({
      type: VaultActionType.SET,
      data: { ...epochData },
    });
    if (account) {
      updatePosition(account);
    }
  }, [dispatch, getEpochData, updatePosition, account]);

  const getUserRyskBalance = useCallback(async () => {
    if (lpContract && account) {
      const balance: BigNumber = await lpContract.balanceOf(account);
      return balance;
    }
  }, [lpContract, account]);

  useEffect(() => {
    const getInfo = async () => {
      const epochData = await getEpochData();
      const balance = await getUserRyskBalance();
      if (epochData || balance) {
        dispatch({
          type: VaultActionType.SET,
          data: {
            depositEpoch: epochData?.depositEpoch,
            withdrawalEpoch: epochData?.withdrawalEpoch,
            withdrawPricePerShare: epochData?.depositEpochPricePerShare,
            withdrawalPricePerShare: epochData?.withdrawalEpochPricePerShare,
            userDHVBalance: balance,
          },
        });
      }
    };

    getInfo();
  }, [dispatch, getEpochData, getUserRyskBalance]);

  return null;
};
