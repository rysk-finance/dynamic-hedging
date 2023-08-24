// This file contains commonly re-used building blocks for the operate function on the option exchange. These are related to the necessary steps for buying or selling options.

import { BigNumber, utils } from "ethers";

import { EMPTY_SERIES, ZERO_ADDRESS } from "src/config/constants";
import {
  OpenVaultCollateralType,
  OpynActionType,
} from "src/enums/OpynActionType";
import RyskActionType from "src/enums/RyskActionType";
import { OptionSeries } from "src/types";
import { fromWeiToOpyn } from "src/utils/conversion-helper";
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
        amount: BigNumber.from(0),
        asset: ZERO_ADDRESS,
        data: ZERO_ADDRESS,
        indexOrAcceptablePremium: BigNumber.from(0),
        optionSeries,
        owner: ZERO_ADDRESS,
        secondAddress: ZERO_ADDRESS,
        vaultId: BigNumber.from(0),
      },
    ];
  }

  return [];
};

export const buyOption = (
  acceptablePremium: BigNumber,
  amount: BigNumber,
  optionSeries: OptionSeries,
  userAddress: HexString
) => {
  return {
    actionType: BigNumber.from(RyskActionType.BuyOption),
    amount,
    asset: ZERO_ADDRESS,
    data: ZERO_ADDRESS,
    indexOrAcceptablePremium: acceptablePremium,
    optionSeries,
    owner: ZERO_ADDRESS,
    secondAddress: userAddress,
    vaultId: BigNumber.from(0),
  };
};

export const openVault = (userAddress: HexString, vaultId: BigNumber) => {
  return {
    actionType: BigNumber.from(OpynActionType.OpenVault),
    owner: userAddress,
    secondAddress: userAddress,
    asset: ZERO_ADDRESS,
    vaultId,
    amount: BigNumber.from(0),
    optionSeries: EMPTY_SERIES,
    indexOrAcceptablePremium: BigNumber.from(0),
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
    indexOrAcceptablePremium: BigNumber.from(0),
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
    amount: fromWeiToOpyn(amount),
    optionSeries: EMPTY_SERIES,
    indexOrAcceptablePremium: BigNumber.from(0),
    data: ZERO_ADDRESS,
  };
};

export const sellOption = (
  acceptablePremium: BigNumber,
  amount: BigNumber,
  optionSeries: OptionSeries,
  userAddress: HexString
) => {
  return {
    actionType: BigNumber.from(RyskActionType.SellOption),
    owner: ZERO_ADDRESS,
    secondAddress: userAddress,
    asset: ZERO_ADDRESS,
    vaultId: BigNumber.from(0),
    amount,
    optionSeries,
    indexOrAcceptablePremium: acceptablePremium,
    data: ZERO_ADDRESS,
  };
};
