import type { BigNumber as BigNumberType } from "ethers";

import type { AddressesRequired } from "../types";

import { prepareWriteContract, writeContract } from "@wagmi/core";
import { BigNumber } from "ethers";

import { OptionExchangeABI } from "src/abis/OptionExchange_ABI";
import { RyskApolloClient } from "src/clients/Apollo/Apollo";
import { QueriesEnum } from "src/clients/Apollo/Queries";
import { EMPTY_SERIES, ZERO_ADDRESS } from "src/config/constants";
import OperationType from "src/enums/OperationType";
import RyskActionType from "src/enums/RyskActionType";
import { fetchSimulation } from "src/hooks/useTenderlySimulator";

export const sell = async (
  addresses: AddressesRequired,
  amount: BigNumberType
) => {
  const txData = [
    {
      operation: OperationType.RyskAction,
      operationQueue: [
        {
          actionType: BigNumber.from(RyskActionType.SellOption),
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
        simulationResponse.simulation.gas_used
      );

      const { hash, wait } = await writeContract(config);

      await wait(1);

      RyskApolloClient.refetchQueries({
        include: [
          QueriesEnum.DASHBOARD_USER_POSITIONS,
          QueriesEnum.USER_BALANCE_DATA,
        ],
      });

      return hash;
    } else {
      throw new Error("Tenderly simulation failed.");
    }
  }
};
