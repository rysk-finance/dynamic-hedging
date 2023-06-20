import { readContract } from "@wagmi/core";

import { NewControllerABI } from "src/abis/NewController_ABI";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";

export const getOperatorStatus = async (
  address?: HexString
): Promise<boolean> => {
  const controllerAddress = getContractAddress("OpynController");
  const exchangeAddress = getContractAddress("optionExchange");

  if (address) {
    try {
      return await readContract({
        address: controllerAddress,
        abi: NewControllerABI,
        functionName: "isOperator",
        args: [address, exchangeAddress],
      });
    } catch (error) {
      logError(error);

      return false;
    }
  } else {
    return false;
  }
};
