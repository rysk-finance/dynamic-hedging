import type { ContractAddresses, ETHNetwork } from "src/types";

import { getNetwork } from "@wagmi/core";
import { BigNumberish, utils } from "ethers";

import addresses from "src/contracts.json";

export const getContractAddress = (contractName: keyof ContractAddresses) => {
  const { chain } = getNetwork();
  const typedAddresses = addresses as Record<ETHNetwork, ContractAddresses>;
  const network =
    !chain?.unsupported && chain?.network
      ? (chain.network as ETHNetwork)
      : (process.env.REACT_APP_NETWORK as ETHNetwork);

  return typedAddresses[network][contractName].toLowerCase() as `0x${string}`;
};

export const shorthandContractAddress = (address: HexString) =>
  `${address.slice(0, 4)}...${address.slice(-4)}`;

export const getOptionHash = (
  expiry: number,
  strike: BigNumberish,
  isPut: boolean
) => {
  return utils.solidityKeccak256(
    ["uint64", "uint128", "bool"],
    [expiry, strike, isPut]
  ) as HexString;
};
