import { prepareWriteContract, writeContract } from "@wagmi/core";

import { NewControllerABI } from "src/abis/NewController_ABI";
import { waitForTransactionOrTimer } from "src/components/shared/utils/waitForTransaction";
import { getContractAddress } from "src/utils/helpers";

export const setOperator = async (isOperator: boolean) => {
  const config = await prepareWriteContract({
    address: getContractAddress("OpynController"),
    abi: NewControllerABI,
    functionName: "setOperator",
    args: [getContractAddress("optionExchange"), !isOperator],
  });

  const { hash } = await writeContract(config);

  await waitForTransactionOrTimer(hash, true);

  return hash;
};
