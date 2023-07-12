import { prepareWriteContract, writeContract } from "@wagmi/core";
import { BigNumber } from "ethers";

import { OptionExchangeABI } from "src/abis/OptionExchange_ABI";
import { waitForTransactionOrTimer } from "src/components/shared/utils/waitForTransaction";
import {
  EMPTY_SERIES,
  GAS_MULTIPLIER,
  ZERO_ADDRESS,
} from "src/config/constants";
import OperationType from "src/enums/OperationType";
import { OpynActionType } from "src/enums/OpynActionType";

export const adjustCollateral = async (
  collateral: BigNumber,
  exchangeAddress: HexString,
  isDepositing: boolean,
  refresh: () => void,
  tokenAddress: HexString,
  userAddress: HexString,
  vaultId: string
) => {
  const txData = [
    {
      operation: OperationType.OpynAction,
      operationQueue: [
        {
          actionType: BigNumber.from(
            isDepositing
              ? OpynActionType.DepositCollateral
              : OpynActionType.WithdrawCollateral
          ),
          owner: userAddress,
          secondAddress: isDepositing ? exchangeAddress : userAddress,
          asset: tokenAddress,
          vaultId: BigNumber.from(vaultId),
          amount: collateral,
          optionSeries: EMPTY_SERIES,
          indexOrAcceptablePremium: BigNumber.from(0),
          data: ZERO_ADDRESS,
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
