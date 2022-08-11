import React from "react";
import { BigNumber } from "ethers";
import { useCallback, useEffect } from "react";
import { toast } from "react-toastify";
import { useWalletContext } from "../../App";
import LPABI from "../../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json";
import { useContract } from "../../hooks/useContract";
import { VaultActionType } from "../../state/types";
import { useVaultContext } from "../../state/VaultContext";

export const VaultStateManagment = () => {
  const { account } = useWalletContext();
  const { dispatch } = useVaultContext();

  const [lpContract] = useContract<{
    EpochExecuted: [];
  }>({
    contract: "liquidityPool",
    ABI: LPABI.abi,
    readOnly: true,
    events: {
      EpochExecuted: async () => {
        toast("✅ The epoch was advanced");
        EpochListener();
      },
    },
    isListening: {
      EpochExecuted: true,
    },
  });

  const getEpochData = useCallback(async () => {
    if (lpContract) {
      const currentEpoch: BigNumber = await lpContract.epoch();
      const latestSharePrice: BigNumber = await lpContract.epochPricePerShare(
        currentEpoch.sub(1)
      );
      return { currentEpoch, latestSharePrice };
    }
  }, [lpContract]);

  const EpochListener = useCallback(async () => {
    const epochData = await getEpochData();
    if (epochData?.currentEpoch || epochData?.latestSharePrice) {
      dispatch({
        type: VaultActionType.SET,
        data: {
          currentPricePerShare: epochData.latestSharePrice,
          currentEpoch: epochData.currentEpoch,
        },
      });
    }
  }, [dispatch, getEpochData]);

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
            currentEpoch: epochData?.currentEpoch,
            currentPricePerShare: epochData?.latestSharePrice,
            userRyskBalance: balance,
          },
        });
      }
    };

    getInfo();
  }, [dispatch, getEpochData, getUserRyskBalance]);

  return null;
};
