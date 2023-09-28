import type { StrategyStrikesTuple } from "src/components/optionsTrading/Modals/SpreadModal/types";
import type { OptionSeries } from "src/types";

import { prepareWriteContract, writeContract } from "@wagmi/core";
import { BigNumber } from "ethers";

import { OptionExchangeABI } from "src/abis/OptionExchange_ABI";
import { waitForTransactionOrTimer } from "src/components/shared/utils/waitForTransaction";
import { GAS_MULTIPLIER, ZERO_ADDRESS } from "src/config/constants";
import OperationType from "src/enums/OperationType";
import { Convert } from "src/utils/Convert";
import { getVaultId } from "../getVaultId";
import {
  buyOption,
  depositCollateral,
  depositLongOption,
  issue,
  mintShortOption,
  openVault,
  sellOption,
} from "./operateBlocks";

export const openSpread = async (
  acceptablePremium: [BigNumber, BigNumber],
  amount: BigNumber,
  collateral: BigNumber,
  collateralAddress: HexString,
  exchangeAddress: HexString,
  exposure: number,
  longOTokenAddress: HexString,
  optionSeries: Omit<OptionSeries, "strike">,
  refresh: () => void,
  shortOTokenAddress: HexString,
  [short, long]: StrategyStrikesTuple,
  userAddress: HexString
) => {
  const [vaultId, hasVault] = await getVaultId(
    collateralAddress,
    longOTokenAddress,
    shortOTokenAddress,
    userAddress
  );

  const [shortAcceptablePremium, longAcceptablePremium] = acceptablePremium;

  const shortSeries: OptionSeries = {
    ...optionSeries,
    strike: Convert.fromStr(short).toWei(),
  };
  const longSeries: OptionSeries = {
    ...optionSeries,
    strike: Convert.fromStr(long).toWei(),
  };

  const requiredShortData = [
    depositCollateral(
      collateral,
      collateralAddress,
      exchangeAddress,
      userAddress,
      vaultId
    ),
    mintShortOption(
      amount,
      exchangeAddress,
      shortOTokenAddress,
      userAddress,
      vaultId
    ),
    depositLongOption(amount, longOTokenAddress, userAddress, vaultId),
  ];

  const txData = [
    {
      operation: OperationType.RyskAction,
      operationQueue: [
        ...issue(optionSeries.collateral, exposure, longSeries),
        buyOption(longAcceptablePremium, amount, longSeries, userAddress),
      ],
    },
    {
      operation: OperationType.OpynAction,
      operationQueue: hasVault
        ? requiredShortData
        : [openVault(userAddress, vaultId), ...requiredShortData],
    },
    {
      operation: OperationType.RyskAction,
      operationQueue: [
        sellOption(
          shortAcceptablePremium,
          amount,
          shortSeries,
          ZERO_ADDRESS,
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
