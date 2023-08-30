import type { StrategyStrikesTuple } from "src/components/optionsTrading/Modals/LongStraddleStrangleModal/types";
import type { OptionSeries } from "src/types";

import { prepareWriteContract, writeContract } from "@wagmi/core";
import { BigNumber } from "ethers";

import { OptionExchangeABI } from "src/abis/OptionExchange_ABI";
import { waitForTransactionOrTimer } from "src/components/shared/utils/waitForTransaction";
import { GAS_MULTIPLIER } from "src/config/constants";
import OperationType from "src/enums/OperationType";
import { toWei } from "src/utils/conversion-helper";
import { buyOption, issue } from "./operateBlocks";

export const openLongStraddleStrangle = async (
  acceptablePremium: BigNumber,
  amount: BigNumber,
  exchangeAddress: HexString,
  exposure: [number, number],
  optionSeries: Omit<OptionSeries, "isPut" | "strike">,
  refresh: () => void,
  selectedStrikes: StrategyStrikesTuple,
  userAddress: HexString
) => {
  const [putExposure, callExposure] = exposure;

  const callSeries: OptionSeries = {
    ...optionSeries,
    isPut: true,
    strike: toWei(selectedStrikes[0]),
  };
  const putSeries: OptionSeries = {
    ...optionSeries,
    isPut: false,
    strike: toWei(selectedStrikes[1]),
  };

  const txData = [
    {
      operation: OperationType.RyskAction,
      operationQueue: [
        ...issue(optionSeries.collateral, putExposure, putSeries),
        buyOption(acceptablePremium, amount, putSeries, userAddress),
        ...issue(optionSeries.collateral, callExposure, callSeries),
        buyOption(acceptablePremium, amount, callSeries, userAddress),
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
