import type { LiquidityPool } from "src/state/types";

import { readContracts } from "@wagmi/core";

import { LiquidityPoolABI } from "src/abis/LiquidityPool_ABI";
import { Convert } from "src/utils/Convert";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";

export const getLiquidityPoolInfo = async (): Promise<LiquidityPool> => {
  try {
    const [checkBuffer, getAssets, collateralCap] = await readContracts({
      contracts: [
        {
          address: getContractAddress("liquidityPool"),
          abi: LiquidityPoolABI,
          functionName: "checkBuffer",
        },
        {
          address: getContractAddress("liquidityPool"),
          abi: LiquidityPoolABI,
          functionName: "getAssets",
        },
        {
          address: getContractAddress("liquidityPool"),
          abi: LiquidityPoolABI,
          functionName: "collateralCap",
        },
      ],
    });

    const remainingBeforeBuffer = Convert.fromUSDC(checkBuffer, 2).toInt();
    const totalAssets = Convert.fromWei(getAssets).toInt();
    const utilisationHigh = (remainingBeforeBuffer / totalAssets) * 100 <= 3;

    return {
      collateralCap: Convert.fromWei(collateralCap).toInt(),
      remainingBeforeBuffer,
      totalAssets,
      utilisationHigh,
    };
  } catch (error) {
    logError(error);

    return {
      collateralCap: 0,
      remainingBeforeBuffer: 0,
      totalAssets: 0,
      utilisationHigh: true,
    };
  }
};
