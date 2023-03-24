import type { BigNumber as BigNumberType } from "ethers";

import type { AddressesRequired } from "../types";

import { prepareWriteContract, writeContract } from "@wagmi/core";
import { BigNumber } from "ethers";

import { erc20ABI } from "src/abis/erc20_ABI";
import { GAS_MULTIPLIER } from "src/config/constants";
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
        simulationResponse.simulation.gas_used * GAS_MULTIPLIER
      );

      const { hash, wait } = await writeContract(config);

      await wait(1);

      return hash;
    } else {
      throw new Error("Tenderly simulation failed.");
    }
  }
};
