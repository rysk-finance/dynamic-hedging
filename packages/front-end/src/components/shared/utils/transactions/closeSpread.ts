import type { CloseLongOperation } from "src/components/optionsTrading/Modals/Shared/types";
import type { StrategyStrikesTuple } from "src/components/optionsTrading/Modals/SpreadModal/types";
import type { OptionSeries } from "src/types";

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
import { Convert } from "src/utils/Convert";
import {
  burnShortOption,
  buyOption,
  closeOption,
  issue,
  sellOption,
  withdrawCollateral,
  withdrawLongOption,
} from "./operateBlocks";

export const closeSpread = async (
  acceptablePremium: [BigNumber, BigNumber],
  amount: BigNumber,
  collateral: BigNumber,
  collateralAddress: HexString,
  exchangeAddress: HexString,
  exposure: number,
  longOTokenAddress: HexString,
  operation: CloseLongOperation,
  optionSeries: Omit<OptionSeries, "strike">,
  refresh: () => void,
  shortOTokenAddress: HexString,
  [short]: StrategyStrikesTuple,
  userAddress: HexString,
  vaultId: BigNumber
) => {
  const [shortAcceptablePremium, longAcceptablePremium] = acceptablePremium;
  const isCredit = !collateral.isZero();

  const shortSeries: OptionSeries = {
    ...optionSeries,
    strike: Convert.fromStr(short).toWei(),
  };

  const requiredShortData = [
    burnShortOption(amount, shortOTokenAddress, userAddress, vaultId),
    withdrawLongOption(
      amount,
      exchangeAddress,
      longOTokenAddress,
      userAddress,
      vaultId
    ),
  ];

  const txData = [
    {
      operation: OperationType.RyskAction,
      operationQueue: [
        ...issue(optionSeries.collateral, exposure, shortSeries),
        buyOption(
          shortAcceptablePremium,
          amount,
          ZERO_ADDRESS,
          shortSeries,
          userAddress
        ),
      ],
    },
    {
      operation: OperationType.OpynAction,
      operationQueue: isCredit
        ? [
            ...requiredShortData,
            withdrawCollateral(
              collateral,
              collateralAddress,
              userAddress,
              vaultId
            ),
          ]
        : requiredShortData,
    },
    {
      operation: OperationType.RyskAction,
      operationQueue: [
        operation === "sell"
          ? sellOption(
              longAcceptablePremium,
              amount,
              EMPTY_SERIES,
              longOTokenAddress,
              userAddress
            )
          : closeOption(
              longAcceptablePremium,
              amount,
              longOTokenAddress,
              userAddress
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
