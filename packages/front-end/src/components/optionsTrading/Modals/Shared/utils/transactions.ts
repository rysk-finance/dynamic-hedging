import { BigNumber as BigNumberType } from "ethers";

import type { UserVaults } from "src/state/types";
import type { OptionSeries } from "src/types";
import type { AddressesRequired, AddressesRequiredVaultSell } from "../types";

import {
  getContract,
  getProvider,
  prepareWriteContract,
  waitForTransaction,
  writeContract,
} from "@wagmi/core";
import { BigNumber, utils, ethers } from "ethers";

import { erc20ABI } from "src/abis/erc20_ABI";
import { NewControllerABI } from "src/abis/NewController_ABI";
import { OptionExchangeABI } from "src/abis/OptionExchange_ABI";
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
import { fetchSimulation } from "src/hooks/useTenderlySimulator";
import { fromWeiToOpyn } from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";

export const approveAllowance = async (
  addresses: AddressesRequired,
  amount: BigNumberType
) => {
  const config = await prepareWriteContract({
    address: addresses.token,
    abi: erc20ABI,
    functionName: "approve",
    args: [addresses.exchange, amount],
  });

  if (config.request.data) {
    const simulationResponse = await fetchSimulation(
      addresses.user,
      addresses.token,
      config.request.data
    );

    if (simulationResponse.simulation.status) {
      config.request.gasLimit = BigNumber.from(
        Math.ceil(simulationResponse.simulation.gas_used * GAS_MULTIPLIER)
      );

      const { hash } = await writeContract(config);

      await waitForTransaction({ hash, confirmations: 1 });

      return hash;
    } else {
      throw new Error("Tenderly simulation failed.");
    }
  }
};

export const buy = async (
  acceptablePremium: BigNumberType,
  addresses: AddressesRequired,
  amount: BigNumberType,
  optionSeries: OptionSeries,
  refresh: () => void
) => {
  const txData = [
    {
      operation: OperationType.RyskAction,
      operationQueue: [
        {
          actionType: BigNumber.from(RyskActionType.Issue),
          owner: ZERO_ADDRESS,
          secondAddress: ZERO_ADDRESS,
          asset: ZERO_ADDRESS,
          vaultId: BigNumber.from(0),
          amount: BigNumber.from(0),
          optionSeries,
          indexOrAcceptablePremium: BigNumber.from(0),
          data: ZERO_ADDRESS,
        },
        {
          actionType: BigNumber.from(RyskActionType.BuyOption),
          owner: ZERO_ADDRESS,
          secondAddress: addresses.user,
          asset: ZERO_ADDRESS,
          vaultId: BigNumber.from(0),
          amount,
          optionSeries,
          indexOrAcceptablePremium: acceptablePremium,
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

  if (config.request.data) {
    const simulationResponse = await fetchSimulation(
      addresses.user,
      addresses.exchange,
      config.request.data
    );

    if (simulationResponse.simulation.status) {
      config.request.gasLimit = BigNumber.from(
        Math.ceil(simulationResponse.simulation.gas_used * GAS_MULTIPLIER)
      );

      const { hash } = await writeContract(config);

      await waitForTransaction({ hash, confirmations: 1 });

      refresh();

      return hash;
    } else {
      throw new Error("Tenderly simulation failed.");
    }
  }
};

export const closeLong = async (
  acceptablePremium: BigNumberType,
  addresses: AddressesRequired,
  amount: BigNumberType,
  refresh: () => void
) => {
  const txData = [
    {
      operation: OperationType.RyskAction,
      operationQueue: [
        {
          actionType: BigNumber.from(RyskActionType.CloseOption),
          owner: ZERO_ADDRESS,
          secondAddress: addresses.user,
          asset: addresses.token,
          vaultId: BigNumber.from(0),
          amount,
          optionSeries: EMPTY_SERIES,
          indexOrAcceptablePremium: acceptablePremium,
          data: "0x" as HexString,
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

  if (config.request.data) {
    const simulationResponse = await fetchSimulation(
      addresses.user,
      addresses.exchange,
      config.request.data
    );

    if (simulationResponse.simulation.status) {
      config.request.gasLimit = BigNumber.from(
        Math.ceil(simulationResponse.simulation.gas_used * GAS_MULTIPLIER)
      );

      const { hash } = await writeContract(config);

      await waitForTransaction({ hash, confirmations: 1 });

      refresh();

      return hash;
    } else {
      throw new Error("Tenderly simulation failed.");
    }
  }
};

export const sell = async (
  acceptablePremium: BigNumberType,
  addresses: AddressesRequired,
  amount: BigNumberType,
  optionSeries: OptionSeries,
  refresh: () => void,
  vaults: UserVaults,
  collateral: BigNumberType
) => {
  // Get oToken address.
  const provider = getProvider();
  const contract = getContract({
    address: addresses.exchange,
    abi: OptionExchangeABI,
    signerOrProvider: provider,
  });

  // OptionExchangeABI is missing `callStatic` so the return type is wrong, hence the conversion to unknown.
  const oTokenAddress = (await contract.callStatic.createOtoken({
    strikeAsset: getContractAddress("USDC"),
    collateral: addresses.token,
    underlying: getContractAddress("WETH"),
    expiration: optionSeries.expiration,
    strike: optionSeries.strike,
    isPut: optionSeries.isPut,
  })) as unknown as HexString;

  const vaultKey = oTokenAddress.toLowerCase() as HexString;
  const hasVault = Boolean(vaults[vaultKey]);

  // Get vaultId from global state or assign next available.
  const vaultId = hasVault
    ? BigNumber.from(vaults[vaultKey])
    : BigNumber.from(++vaults.length);

  const openVaultData = {
    actionType: BigNumber.from(OpynActionType.OpenVault),
    owner: addresses.user,
    secondAddress: addresses.user,
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

  const requiredData = [
    {
      actionType: BigNumber.from(OpynActionType.DepositCollateral),
      owner: addresses.user,
      secondAddress: addresses.exchange,
      asset: addresses.token,
      vaultId,
      amount: collateral,
      optionSeries: EMPTY_SERIES,
      indexOrAcceptablePremium: BigNumber.from(0),
      data: ZERO_ADDRESS,
    },
    {
      actionType: BigNumber.from(OpynActionType.MintShortOption),
      owner: addresses.user,
      secondAddress: addresses.exchange,
      asset: oTokenAddress,
      vaultId,
      amount: fromWeiToOpyn(amount),
      optionSeries: EMPTY_SERIES,
      indexOrAcceptablePremium: BigNumber.from(0),
      data: ZERO_ADDRESS,
    },
  ];

  const txData = [
    {
      operation: OperationType.OpynAction,
      operationQueue: hasVault
        ? requiredData
        : [openVaultData, ...requiredData],
    },
    {
      operation: OperationType.RyskAction,
      operationQueue: [
        {
          actionType: BigNumber.from(RyskActionType.SellOption),
          owner: ZERO_ADDRESS,
          secondAddress: addresses.user,
          asset: ZERO_ADDRESS,
          vaultId: BigNumber.from(0),
          amount,
          optionSeries,
          indexOrAcceptablePremium: acceptablePremium,
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

  if (config.request.data) {
    const simulationResponse = await fetchSimulation(
      addresses.user,
      addresses.exchange,
      config.request.data
    );

    if (simulationResponse.simulation.status) {
      config.request.gasLimit = BigNumber.from(
        Math.ceil(simulationResponse.simulation.gas_used * GAS_MULTIPLIER)
      );

      const { hash } = await writeContract(config);

      await waitForTransaction({ hash, confirmations: 1 });

      refresh();

      return hash;
    } else {
      throw new Error("Tenderly simulation failed.");
    }
  }
};

export const setOperator = async (isOperator: boolean) => {
  const config = await prepareWriteContract({
    address: getContractAddress("OpynController"),
    abi: NewControllerABI,
    functionName: "setOperator",
    args: [getContractAddress("optionExchange"), !isOperator],
  });

  const { hash } = await writeContract(config);

  await waitForTransaction({ hash, confirmations: 1 });

  return hash;
};

export const vaultSell = async (
  acceptablePremium: BigNumberType,
  addresses: AddressesRequiredVaultSell,
  amount: BigNumberType,
  refresh: () => void,
  collateralAmount: BigNumberType
) => {
  const txData = [
    {
      operation: OperationType.RyskAction,
      operationQueue: [
        {
          actionType: BigNumber.from(RyskActionType.BuyOption),
          owner: ZERO_ADDRESS,
          secondAddress: addresses.user,
          asset: addresses.token,
          vaultId: BigNumber.from(0),
          amount: amount,
          optionSeries: EMPTY_SERIES,
          indexOrAcceptablePremium: BigNumber.from(0),
          data: "0x" as HexString,
        },
      ],
    },
    {
      operation: OperationType.OpynAction,
      operationQueue: [
        {
          actionType: BigNumber.from(OpynActionType.BurnShortOption),
          owner: addresses.user,
          secondAddress: addresses.user,
          asset: addresses.token,
          vaultId: BigNumber.from(addresses.vaultID),
          amount: amount.div(ethers.utils.parseUnits("1", 10)), // Rysk e18 to Opyn e8
          optionSeries: EMPTY_SERIES,
          indexOrAcceptablePremium: BigNumber.from(0),
          data: "0x" as HexString,
        },
        {
          actionType: BigNumber.from(OpynActionType.WithdrawCollateral),
          owner: addresses.user,
          secondAddress: addresses.user,
          asset: addresses.collateral,
          vaultId: BigNumber.from(addresses.vaultID),
          amount: collateralAmount,
          optionSeries: EMPTY_SERIES,
          indexOrAcceptablePremium: BigNumber.from(0),
          data: "0x" as HexString,
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

  if (config.request.data) {
    const simulationResponse = await fetchSimulation(
      addresses.user,
      addresses.exchange,
      config.request.data
    );

    if (simulationResponse.simulation.status) {
      config.request.gasLimit = BigNumber.from(
        Math.ceil(simulationResponse.simulation.gas_used * GAS_MULTIPLIER)
      );

      const { hash } = await writeContract(config);

      await waitForTransaction({ hash, confirmations: 2 });

      refresh();

      return hash;
    } else {
      throw new Error("Tenderly simulation failed.");
    }
  }
};
