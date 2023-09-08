import type { UserVaults } from "src/state/types";

import { readContract } from "@wagmi/core";

import { UserPositionLensMK1ABI } from "src/abis/UserPositionLensMK1_ABI";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";

export const getUserVaults = async (
  address?: HexString
): Promise<UserVaults> => {
  const userPositionsLens = getContractAddress("UserPositionLens");

  if (!address) return { length: 0 };

  try {
    const vaults = await readContract({
      address: userPositionsLens,
      abi: UserPositionLensMK1ABI,
      functionName: "getVaultsForUser",
      args: [address],
    });

    return vaults.reduce(
      (userVaults, currentVault) => {
        const address = currentVault.shortOtoken.toLowerCase() as HexString;

        userVaults[address] = currentVault.vaultId.toString();
        userVaults.length = userVaults.length + 1;

        return userVaults;
      },
      { length: 0 } as UserVaults
    );
  } catch (error) {
    logError(error);

    return { length: 0 };
  }
};
