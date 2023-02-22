import { readContract } from "@wagmi/core";
import { OpynOracleABI } from "../../abis/OpynOracle_ABI";
import { getContractAddress } from "../../utils/helpers";

const useOraclePrice = () => {
  // Addresses
  const opynOracleAddress = getContractAddress("OpynOracle");

  // Contract read
  const getPrice = async (asset: HexString) => {
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
