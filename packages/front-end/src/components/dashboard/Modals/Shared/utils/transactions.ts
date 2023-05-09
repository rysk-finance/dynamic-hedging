import { AddressesRequired } from "src/components/optionsTrading/Modals/Shared/types";
import { BigNumber as BigNumberType } from "@ethersproject/bignumber/lib/bignumber";
import OperationType from "src/enums/OperationType";
import { BigNumber } from "ethers";
import {
  EMPTY_SERIES,
  GAS_MULTIPLIER,
  ZERO_ADDRESS,
} from "src/config/constants";
import {
  prepareWriteContract,
  waitForTransaction,
  writeContract,
} from "@wagmi/core";
import { OptionExchangeABI } from "src/abis/OptionExchange_ABI";
import { OpynActionType } from "src/enums/OpynActionType";

export const updateCollateral = async (
  addresses: AddressesRequired,
  collateral: BigNumberType,
  vaultId: string,
  isWithdraw: boolean,
  refresh: () => void
) => {
  const txData = [
    {
      operation: OperationType.OpynAction,
      operationQueue: [
        {
          actionType: BigNumber.from(
            isWithdraw
              ? OpynActionType.WithdrawCollateral
              : OpynActionType.DepositCollateral
          ),
          owner: addresses.user,
          secondAddress: isWithdraw ? addresses.user : addresses.exchange,
          asset: addresses.token,
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
    address: addresses.exchange,
    abi: OptionExchangeABI,
    functionName: "operate",
    args: [txData],
  });
  config.request.gasLimit = config.request.gasLimit
    .mul(GAS_MULTIPLIER * 100)
    .div(100);

  if (config.request.data) {
    const { hash } = await writeContract(config);

    await waitForTransaction({ hash, confirmations: 1 });

    refresh();

    return hash;
  }
};
