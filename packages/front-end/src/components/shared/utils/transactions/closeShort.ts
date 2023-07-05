import { BigNumber as BigNumberType } from "ethers";

import { prepareWriteContract, writeContract } from "@wagmi/core";
import { BigNumber, ethers } from "ethers";

import { OptionExchangeABI } from "src/abis/OptionExchange_ABI";
import { waitForTransactionOrTimer } from "src/components/shared/utils/waitForTransaction";
import {
  EMPTY_SERIES,
  GAS_MULTIPLIER,
  ZERO_ADDRESS,
} from "src/config/constants";
import OperationType from "src/enums/OperationType";
import { OpynActionType } from "src/enums/OpynActionType";
import RyskActionType from "src/enums/RyskActionType";

export const closeShort = async (
  acceptablePremium: BigNumberType,
  amount: BigNumberType,
  exchangeAddress: HexString,
  collateralAddress: HexString,
  collateralAmount: BigNumberType,
  refresh: () => void,
  tokenAddress: HexString,
  userAddress: HexString,
  vaultId: string
) => {
  const txData = [
    {
      operation: OperationType.RyskAction,
      operationQueue: [
        {
          actionType: BigNumber.from(RyskActionType.BuyOption),
          owner: ZERO_ADDRESS,
          secondAddress: userAddress,
          asset: tokenAddress,
          vaultId: BigNumber.from(0),
          amount: amount,
          optionSeries: EMPTY_SERIES,
          indexOrAcceptablePremium: acceptablePremium,
          data: "0x" as HexString,
        },
      ],
    },
    {
      operation: OperationType.OpynAction,
      operationQueue: [
        {
          actionType: BigNumber.from(OpynActionType.BurnShortOption),
          owner: userAddress,
          secondAddress: userAddress,
          asset: tokenAddress,
          vaultId: BigNumber.from(vaultId),
          amount: amount.div(ethers.utils.parseUnits("1", 10)), // Rysk e18 to Opyn e8
          optionSeries: EMPTY_SERIES,
          indexOrAcceptablePremium: BigNumber.from(0),
          data: "0x" as HexString,
        },
        {
          actionType: BigNumber.from(OpynActionType.WithdrawCollateral),
          owner: userAddress,
          secondAddress: userAddress,
          asset: collateralAddress,
          vaultId: BigNumber.from(vaultId),
          amount: collateralAmount,
          optionSeries: EMPTY_SERIES,
          indexOrAcceptablePremium: BigNumber.from(0),
          data: "0x" as HexString,
        },
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
    .mul(GAS_MULTIPLIER * 100)
    .div(100);

  if (config.request.data) {
    const { hash } = await writeContract(config);

    await waitForTransactionOrTimer(hash);

    refresh();

    return hash;
  }
};
