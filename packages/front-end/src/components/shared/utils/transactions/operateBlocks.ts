// This file contains commonly re-used building blocks for the operate function on the option exchange. These are related to the necessary steps for buying or selling options.

import { BigNumber, utils } from "ethers";

import { EMPTY_SERIES, ZERO_ADDRESS } from "src/config/constants";
import {
  OpenVaultCollateralType,
  OpynActionType,
} from "src/enums/OpynActionType";
import RyskActionType from "src/enums/RyskActionType";
import { OptionSeries } from "src/types";
import { Convert } from "src/utils/Convert";
import { getContractAddress } from "src/utils/helpers";

// The return value must be spread into the queue.
// This is due to the queue not filtering out empty objects.
export const issue = (
  collateralAddress: HexString,
  exposure: number,
  optionSeries: OptionSeries
) => {
  if (collateralAddress !== getContractAddress("WETH") && exposure >= 0) {
    return [
      {
        actionType: BigNumber.from(RyskActionType.Issue),
        amount: Convert.BIG_ZERO,
        asset: ZERO_ADDRESS,
        data: ZERO_ADDRESS,
        indexOrAcceptablePremium: Convert.BIG_ZERO,
        optionSeries,
        owner: ZERO_ADDRESS,
        secondAddress: ZERO_ADDRESS,
        vaultId: Convert.BIG_ZERO,
      },
    ];
  }

  return [];
};

export const buyOption = (
  acceptablePremium: BigNumber,
  amount: BigNumber,
  asset: HexString,
  optionSeries: OptionSeries,
  userAddress: HexString
) => {
  return {
    actionType: BigNumber.from(RyskActionType.BuyOption),
    amount,
    asset,
    data: ZERO_ADDRESS,
    indexOrAcceptablePremium: acceptablePremium,
    optionSeries,
    owner: ZERO_ADDRESS,
    secondAddress: userAddress,
    vaultId: Convert.BIG_ZERO,
  };
};

export const openVault = (userAddress: HexString, vaultId: BigNumber) => {
  return {
    actionType: BigNumber.from(OpynActionType.OpenVault),
    owner: userAddress,
    secondAddress: userAddress,
    asset: ZERO_ADDRESS,
    vaultId,
    amount: Convert.BIG_ZERO,
    optionSeries: EMPTY_SERIES,
    indexOrAcceptablePremium: Convert.BIG_ZERO,
    data: utils.hexZeroPad(
      utils.hexlify([OpenVaultCollateralType.Partially]),
      32
    ) as HexString,
  };
};

export const depositCollateral = (
  collateral: BigNumber,
  collateralAddress: HexString,
  exchangeAddress: HexString,
  userAddress: HexString,
  vaultId: BigNumber
) => {
  return {
    actionType: BigNumber.from(OpynActionType.DepositCollateral),
    owner: userAddress,
    secondAddress: exchangeAddress,
    asset: collateralAddress,
    vaultId,
    amount: collateral,
    optionSeries: EMPTY_SERIES,
    indexOrAcceptablePremium: Convert.BIG_ZERO,
    data: ZERO_ADDRESS,
  };
};

export const mintShortOption = (
  amount: BigNumber,
  exchangeAddress: HexString,
  oTokenAddress: HexString,
  userAddress: HexString,
  vaultId: BigNumber
) => {
  return {
    actionType: BigNumber.from(OpynActionType.MintShortOption),
    owner: userAddress,
    secondAddress: exchangeAddress,
    asset: oTokenAddress,
    vaultId,
    amount: Convert.fromWei(amount).toOpyn(),
    optionSeries: EMPTY_SERIES,
    indexOrAcceptablePremium: Convert.BIG_ZERO,
    data: ZERO_ADDRESS,
  };
};

export const sellOption = (
  acceptablePremium: BigNumber,
  amount: BigNumber,
  optionSeries: OptionSeries,
  tokenAddress: HexString,
  userAddress: HexString
) => {
  return {
    actionType: BigNumber.from(RyskActionType.SellOption),
    owner: ZERO_ADDRESS,
    secondAddress: userAddress,
    asset: tokenAddress,
    vaultId: Convert.BIG_ZERO,
    amount,
    optionSeries,
    indexOrAcceptablePremium: acceptablePremium,
    data: ZERO_ADDRESS,
  };
};

export const closeOption = (
  acceptablePremium: BigNumber,
  amount: BigNumber,
  tokenAddress: HexString,
  userAddress: HexString
) => {
  return {
    actionType: BigNumber.from(RyskActionType.CloseOption),
    owner: ZERO_ADDRESS,
    secondAddress: userAddress,
    asset: tokenAddress,
    vaultId: Convert.BIG_ZERO,
    amount,
    optionSeries: EMPTY_SERIES,
    indexOrAcceptablePremium: acceptablePremium,
    data: ZERO_ADDRESS,
  };
};

export const depositLongOption = (
  amount: BigNumber,
  oTokenAddress: HexString,
  userAddress: HexString,
  vaultId: BigNumber
) => {
  return {
    actionType: BigNumber.from(OpynActionType.DepositLongOption),
    owner: userAddress,
    secondAddress: userAddress,
    asset: oTokenAddress,
    vaultId,
    amount: Convert.fromWei(amount).toOpyn(),
    optionSeries: EMPTY_SERIES,
    indexOrAcceptablePremium: Convert.BIG_ZERO,
    data: ZERO_ADDRESS,
  };
};

export const burnShortOption = (
  amount: BigNumber,
  oTokenAddress: HexString,
  userAddress: HexString,
  vaultId: BigNumber
) => {
  return {
    actionType: BigNumber.from(OpynActionType.BurnShortOption),
    owner: userAddress,
    secondAddress: userAddress,
    asset: oTokenAddress,
    vaultId: BigNumber.from(vaultId),
    amount: Convert.fromWei(amount).toOpyn(),
    optionSeries: EMPTY_SERIES,
    indexOrAcceptablePremium: Convert.BIG_ZERO,
    data: ZERO_ADDRESS,
  };
};

export const withdrawLongOption = (
  amount: BigNumber,
  exchangeAddress: HexString,
  oTokenAddress: HexString,
  userAddress: HexString,
  vaultId: BigNumber
) => {
  return {
    actionType: BigNumber.from(OpynActionType.WithdrawLongOption),
    owner: userAddress,
    secondAddress: exchangeAddress,
    asset: oTokenAddress,
    vaultId,
    amount: Convert.fromWei(amount).toOpyn(),
    optionSeries: EMPTY_SERIES,
    indexOrAcceptablePremium: Convert.BIG_ZERO,
    data: ZERO_ADDRESS,
  };
};

export const withdrawCollateral = (
  collateral: BigNumber,
  collateralAddress: HexString,
  userAddress: HexString,
  vaultId: BigNumber
) => {
  return {
    actionType: BigNumber.from(OpynActionType.WithdrawCollateral),
    owner: userAddress,
    secondAddress: userAddress,
    asset: collateralAddress,
    vaultId: BigNumber.from(vaultId),
    amount: collateral,
    optionSeries: EMPTY_SERIES,
    indexOrAcceptablePremium: BigNumber.from(0),
    data: "0x" as HexString,
  };
};
