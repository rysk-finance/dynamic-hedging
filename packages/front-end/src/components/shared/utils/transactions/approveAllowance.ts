import { prepareWriteContract, writeContract } from "@wagmi/core";
import { BigNumber, constants } from "ethers";

import { erc20ABI } from "src/abis/erc20_ABI";
import { waitForTransactionOrTimer } from "src/components/shared/utils/waitForTransaction";
import { GAS_MULTIPLIER } from "src/config/constants";

export const approveAllowance = async (
  exchangeAddress: HexString,
  tokenAddress: HexString,
  amount: BigNumber,
  unlimitedApproval?: boolean
) => {
  const config = await prepareWriteContract({
    address: tokenAddress,
    abi: erc20ABI,
    functionName: "approve",
    args: [exchangeAddress, unlimitedApproval ? constants.MaxUint256 : amount],
  });
  config.request.gasLimit = config.request.gasLimit
    .mul(Math.floor(GAS_MULTIPLIER * 100))
    .div(100);

  if (config.request.data) {
    const { hash } = await writeContract(config);

    await waitForTransactionOrTimer(hash, true);

    return hash;
  }
};
