import type { LiquidityPool } from "src/state/types";

import { readContracts } from "@wagmi/core";

import { LiquidityPoolABI } from "src/abis/LiquidityPool_ABI";
import { fromWeiToInt, tFormatUSDC } from "src/utils/conversion-helper";
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

    const remainingBeforeBuffer = tFormatUSDC(checkBuffer, 2);
    const totalAssets = fromWeiToInt(getAssets);
    const utilisationHigh = (remainingBeforeBuffer / totalAssets) * 100 <= 3;

    return {
      collateralCap: fromWeiToInt(collateralCap),
      remainingBeforeBuffer,
      totalAssets,
      utilisationHigh,
    };
  } catch (error) {
    logError(error);

    return {
      collateralCap:0,
      remainingBeforeBuffer: 0,
      totalAssets: 0,
      utilisationHigh: true,
    };
  }
};
