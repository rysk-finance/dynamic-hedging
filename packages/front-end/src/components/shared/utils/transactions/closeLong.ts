import type { CloseLongOperation } from "src/components/optionsTrading/Modals/CloseOptionModal/types";

import { prepareWriteContract, writeContract } from "@wagmi/core";
import { BigNumber } from "ethers";

import { OptionExchangeABI } from "src/abis/OptionExchange_ABI";
import { waitForTransactionOrTimer } from "src/components/shared/utils/waitForTransaction";
import { EMPTY_SERIES, GAS_MULTIPLIER } from "src/config/constants";
import OperationType from "src/enums/OperationType";
import { closeOption, sellOption } from "./operateBlocks";

export const closeLong = async (
  acceptablePremium: BigNumber,
  amount: BigNumber,
  exchangeAddress: HexString,
  refresh: () => void,
  tokenAddress: HexString,
  userAddress: HexString,
  operation: CloseLongOperation
) => {
  const txData = [
    {
      operation: OperationType.RyskAction,
      operationQueue: [
        operation === "sell"
          ? sellOption(
              acceptablePremium,
              amount,
              EMPTY_SERIES,
              tokenAddress,
              userAddress
            )
          : closeOption(acceptablePremium, amount, tokenAddress, userAddress),
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
