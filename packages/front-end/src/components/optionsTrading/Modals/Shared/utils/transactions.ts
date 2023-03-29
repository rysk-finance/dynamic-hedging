import type { BigNumber as BigNumberType } from "ethers";

import type { OptionSeries } from "src/types";
import type { AddressesRequired } from "../types";

import { prepareWriteContract, writeContract } from "@wagmi/core";
import { BigNumber } from "ethers";
import { erc20ABI } from "src/abis/erc20_ABI";
import { OptionExchangeABI } from "src/abis/OptionExchange_ABI";
import {
  EMPTY_SERIES,
  GAS_MULTIPLIER,
  ZERO_ADDRESS,
} from "src/config/constants";
import OperationType from "src/enums/OperationType";
import RyskActionType from "src/enums/RyskActionType";
import { fetchSimulation } from "src/hooks/useTenderlySimulator";

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

      const { hash, wait } = await writeContract(config);

      await wait(1);

      return hash;
    } else {
      throw new Error("Tenderly simulation failed.");
    }
  }
};

export const sell = async (
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
          index: BigNumber.from(0),
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

      const { hash, wait } = await writeContract(config);

      await wait(2);

      refresh();

      return hash;
    } else {
      throw new Error("Tenderly simulation failed.");
    }
  }
};

export const buy = async (
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
          index: BigNumber.from(0),
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
          index: BigNumber.from(0),
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

      const { hash, wait } = await writeContract(config);

      await wait(2);

      refresh();

      return hash;
    } else {
      throw new Error("Tenderly simulation failed.");
    }
  }
};
