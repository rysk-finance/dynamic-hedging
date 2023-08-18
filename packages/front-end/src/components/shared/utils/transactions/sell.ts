import type { UserVaults } from "src/state/types";
import type { OptionSeries } from "src/types";

import { prepareWriteContract, writeContract } from "@wagmi/core";
import { BigNumber, utils } from "ethers";

import { OptionExchangeABI } from "src/abis/OptionExchange_ABI";
import { waitForTransactionOrTimer } from "src/components/shared/utils/waitForTransaction";
import {
  EMPTY_SERIES,
  GAS_MULTIPLIER,
  ZERO_ADDRESS,
} from "src/config/constants";
import OperationType from "src/enums/OperationType";
import {
  OpenVaultCollateralType,
  OpynActionType,
} from "src/enums/OpynActionType";
import RyskActionType from "src/enums/RyskActionType";
import { fromWeiToOpyn } from "src/utils/conversion-helper";
import {
  depositCollateral,
  mintShortOption,
  openVault,
  sellOption,
} from "./operateBlocks";

export const sell = async (
  acceptablePremium: BigNumber,
  amount: BigNumber,
  collateral: BigNumber,
  collateralAddress: HexString,
  exchangeAddress: HexString,
  optionSeries: OptionSeries,
  oTokenAddress: HexString,
  refresh: () => void,
  userAddress: HexString,
  vaults: UserVaults
) => {
  const vaultKey = oTokenAddress.toLowerCase() as HexString;
  const hasVault = Boolean(vaults[vaultKey]);

  // Get vaultId from global state or assign next available.
  const vaultId = hasVault
    ? BigNumber.from(vaults[vaultKey])
    : BigNumber.from(vaults.length + 1);

  const requiredData = [
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
      oTokenAddress,
      userAddress,
      vaultId
    ),
  ];

  const txData = [
    {
      operation: OperationType.OpynAction,
      operationQueue: hasVault
        ? requiredData
        : [openVault(userAddress, vaultId), ...requiredData],
    },
    {
      operation: OperationType.RyskAction,
      operationQueue: [
        sellOption(acceptablePremium, amount, optionSeries, userAddress),
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
