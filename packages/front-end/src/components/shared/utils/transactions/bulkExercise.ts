import type { ActivePositions } from "src/state/types";

import { prepareWriteContract, writeContract } from "@wagmi/core";
import { BigNumber } from "ethers";

import { NewControllerABI } from "src/abis/NewController_ABI";
import { PositionAction } from "src/components/optionsTrading/UserStats/enums";
import { waitForTransactionOrTimer } from "src/components/shared/utils/waitForTransaction";
import { GAS_MULTIPLIER, ZERO_ADDRESS } from "src/config/constants";
import { OpynActionType } from "src/enums/OpynActionType";
import { Convert } from "src/utils/Convert";
import { getContractAddress } from "src/utils/helpers";

const opynControllerAddress = getContractAddress("OpynController");

export const bulkExercise = async (
  positions: ActivePositions[],
  refresh: () => void,
  userAddress: HexString
) => {
  const txData = positions.map(({ action, amount, collateral, id }) => {
    if (action === PositionAction.BURN || action === PositionAction.REDEEM) {
      return {
        actionType: OpynActionType.Redeem,
        owner: ZERO_ADDRESS,
        secondAddress: userAddress,
        asset: id,
        vaultId: Convert.BIG_ZERO,
        amount: Convert.fromInt(amount).toOpyn(),
        index: Convert.BIG_ZERO,
        data: ZERO_ADDRESS,
      };
    } else {
      return {
        actionType: OpynActionType.SettleVault,
        owner: userAddress,
        secondAddress: userAddress,
        asset: ZERO_ADDRESS,
        vaultId: BigNumber.from(collateral.vault?.vaultId),
        amount: Convert.BIG_ZERO,
        index: Convert.BIG_ZERO,
        data: ZERO_ADDRESS,
      };
    }
  });

  const config = await prepareWriteContract({
    address: opynControllerAddress,
    abi: NewControllerABI,
    functionName: "operate",
    args: [txData],
  });

  config.request.gasLimit = config.request.gasLimit
    .mul(Math.floor(GAS_MULTIPLIER * 100))
    .div(100);

  if (config.request.data) {
    const { hash } = await writeContract(config);

    await waitForTransactionOrTimer(hash);

    refresh();

    return hash;
  }
};
