import { useEffect } from "react";
import { useAccount } from "wagmi";
import { readContracts } from "@wagmi/core";

import { LiquidityPoolABI } from "src/abis/LiquidityPool_ABI";
import { VaultActionType } from "../../state/types";
import { useVaultContext } from "../../state/VaultContext";
import { getContractAddress } from "src/utils/helpers";

const liquidityPoolContract = {
  address: getContractAddress("liquidityPool"),
  abi: LiquidityPoolABI,
} as const;

export const VaultStateManagment = () => {
  const { address } = useAccount();
  const { dispatch } = useVaultContext();

  useEffect(() => {
    const getInfo = async () => {
      if (address) {
        const [userDHVBalance, depositEpoch, withdrawalEpoch] =
          await readContracts({
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
            ],
          });

        const [withdrawPricePerShare, withdrawalPricePerShare] =
          await readContracts({
            contracts: [
              {
                ...liquidityPoolContract,
                functionName: "depositEpochPricePerShare",
                args: [depositEpoch.sub(1)],
              },
              {
                ...liquidityPoolContract,
                functionName: "withdrawalEpochPricePerShare",
                args: [withdrawalEpoch.sub(1)],
              },
            ],
          });

        dispatch({
          type: VaultActionType.SET,
          data: {
            depositEpoch,
            withdrawalEpoch,
            withdrawPricePerShare,
            withdrawalPricePerShare,
            userDHVBalance,
          },
        });
      }
    };

    getInfo();
  }, []);

  return null;
};
