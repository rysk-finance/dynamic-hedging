import type { OptionSeries } from "src/types";

import { prepareWriteContract, writeContract } from "@wagmi/core";
import { BigNumber } from "ethers";

import { OptionExchangeABI } from "src/abis/OptionExchange_ABI";
import { waitForTransactionOrTimer } from "src/components/shared/utils/waitForTransaction";
import { GAS_MULTIPLIER, ZERO_ADDRESS } from "src/config/constants";
import OperationType from "src/enums/OperationType";
import RyskActionType from "src/enums/RyskActionType";
import { getContractAddress } from "src/utils/helpers";

export const buy = async (
  acceptablePremium: BigNumber,
  amount: BigNumber,
  exchangeAddress: HexString,
  optionSeries: OptionSeries,
  refresh: () => void,
  userAddress: HexString
) => {
  const operations = [];

  if (optionSeries.collateral !== getContractAddress("WETH"))
    operations.push({
      actionType: BigNumber.from(RyskActionType.Issue),
      owner: ZERO_ADDRESS,
      secondAddress: ZERO_ADDRESS,
      asset: ZERO_ADDRESS,
      vaultId: BigNumber.from(0),
      amount: BigNumber.from(0),
      optionSeries,
      indexOrAcceptablePremium: BigNumber.from(0),
      data: ZERO_ADDRESS,
    });

  operations.push({
    actionType: BigNumber.from(RyskActionType.BuyOption),
    owner: ZERO_ADDRESS,
    secondAddress: userAddress,
    asset: ZERO_ADDRESS,
    vaultId: BigNumber.from(0),
    amount,
    optionSeries,
    indexOrAcceptablePremium: acceptablePremium,
    data: ZERO_ADDRESS,
  });

  const txData = [
    {
      operation: OperationType.RyskAction,
      operationQueue: operations,
    },
  ];

  const config = await prepareWriteContract({
    address: exchangeAddress,
    abi: OptionExchangeABI,
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
