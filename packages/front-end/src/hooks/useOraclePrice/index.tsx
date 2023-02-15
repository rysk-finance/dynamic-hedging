import { readContract, getNetwork } from "@wagmi/core";
import OpynOracleABI from "../../abis/opyn/Oracle.json";
import { getContractAddress } from "../../utils/helpers";

const useOraclePrice = () => {
  // Addresses
  const opynOracleAddress = getContractAddress("OpynOracle");

  // Contract read
  const getPrice = async (asset: string) => {
    return await readContract({
      address: opynOracleAddress,
      abi: OpynOracleABI,
      functionName: "getPrice",
      args: [asset],
    });
  };

  return [
    getPrice, // retrieve price of asset
  ];
};

export default useOraclePrice;
