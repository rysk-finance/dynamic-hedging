import { prepareWriteContract, writeContract } from "@wagmi/core";
import { BigNumber } from "ethers";

import { NewControllerABI } from "src/abis/NewController_ABI";
import { waitForTransactionOrTimer } from "src/components/shared/utils/waitForTransaction";
import { GAS_MULTIPLIER, ZERO_ADDRESS } from "src/config/constants";
import { OpynActionType } from "src/enums/OpynActionType";
import { getContractAddress } from "src/utils/helpers";

const opynControllerAddress = getContractAddress("OpynController");

export const redeemOrBurn = async (
  amount: BigNumber,
  userAddress: HexString,
  tokenAddress: HexString,
  refresh: () => void
) => {
  const txData = [
    {
      actionType: OpynActionType.Redeem,
      owner: ZERO_ADDRESS,
      secondAddress: userAddress,
      asset: tokenAddress,
      vaultId: BigNumber.from(0),
      amount,
      index: BigNumber.from(0),
      data: ZERO_ADDRESS,
    },
  ];

  const config = await prepareWriteContract({
    address: opynControllerAddress,
    abi: NewControllerABI,
    functionName: "operate",
    args: [txData],
  });

  config.request.gasLimit = config.request.gasLimit
    .mul(GAS_MULTIPLIER * 100)
    .div(100);

  if (config.request.data) {
    const { hash } = await writeContract(config);

    await waitForTransactionOrTimer(hash);

    refresh();

    return hash;
  }
};
