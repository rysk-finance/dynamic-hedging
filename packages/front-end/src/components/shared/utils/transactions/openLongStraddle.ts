import type { OptionSeries } from "src/types";

import { prepareWriteContract, writeContract } from "@wagmi/core";
import { BigNumber } from "ethers";

import { OptionExchangeABI } from "src/abis/OptionExchange_ABI";
import { waitForTransactionOrTimer } from "src/components/shared/utils/waitForTransaction";
import { GAS_MULTIPLIER } from "src/config/constants";
import OperationType from "src/enums/OperationType";
import { buyOption, issue } from "./operateBlocks";

export const openLongStraddle = async (
  acceptablePremium: BigNumber,
  amount: BigNumber,
  exchangeAddress: HexString,
  optionSeries: Omit<OptionSeries, "isPut">,
  refresh: () => void,
  userAddress: HexString
) => {
  const callSeries = { ...optionSeries, isPut: false };
  const putSeries = { ...optionSeries, isPut: true };

  const txData = [
    {
      operation: OperationType.RyskAction,
      operationQueue: [
        ...issue(optionSeries.collateral, callSeries),
        buyOption(acceptablePremium, amount, callSeries, userAddress),
      ],
    },
    {
      operation: OperationType.RyskAction,
      operationQueue: [
        ...issue(optionSeries.collateral, putSeries),
        buyOption(acceptablePremium, amount, putSeries, userAddress),
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