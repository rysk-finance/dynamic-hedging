import { prepareWriteContract, writeContract } from "@wagmi/core";
import { BigNumber } from "ethers";

import { OptionExchangeABI } from "src/abis/OptionExchange_ABI";
import { waitForTransactionOrTimer } from "src/components/shared/utils/waitForTransaction";
import { EMPTY_SERIES, GAS_MULTIPLIER } from "src/config/constants";
import OperationType from "src/enums/OperationType";
import {
  burnShortOption,
  buyOption,
  withdrawCollateral,
} from "./operateBlocks";

export const closeShort = async (
  acceptablePremium: BigNumber,
  amount: BigNumber,
  exchangeAddress: HexString,
  collateralAddress: HexString,
  collateralAmount: BigNumber,
  refresh: () => void,
  tokenAddress: HexString,
  userAddress: HexString,
  vaultId: string
) => {
  const vaultBigNumber = BigNumber.from(vaultId);

  const txData = [
    {
      operation: OperationType.RyskAction,
      operationQueue: [
        buyOption(acceptablePremium, amount, EMPTY_SERIES, userAddress),
      ],
    },
    {
      operation: OperationType.OpynAction,
      operationQueue: [
        burnShortOption(amount, tokenAddress, userAddress, vaultBigNumber),
        withdrawCollateral(
          collateralAmount,
          collateralAddress,
          userAddress,
          vaultBigNumber
        ),
      ],
    },
  ];

  const config = await prepareWriteContract({
    address: exchangeAddress,
    abi: OptionExchangeABI,
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
