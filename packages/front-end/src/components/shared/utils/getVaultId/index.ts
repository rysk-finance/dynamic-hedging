import { readContract } from "@wagmi/core";

import { UserPositionLensMK1ABI } from "src/abis/UserPositionLensMK1_ABI";
import { getContractAddress } from "src/utils/helpers";

export const getVaultId = async (
  collateralAddress: HexString,
  longOTokenAddress: HexString,
  shortOTokenAddress: HexString,
  userAddress: HexString
) =>
  await readContract({
    abi: UserPositionLensMK1ABI,
    address: getContractAddress("UserPositionLens"),
    functionName: "getVaultsForUserAndOtoken",
    args: [
      userAddress,
      shortOTokenAddress,
      longOTokenAddress,
      collateralAddress,
    ],
  });
