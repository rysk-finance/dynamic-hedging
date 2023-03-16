import { readContract } from "@wagmi/core";
import { OracleABI } from "../../abis/Oracle_ABI";
import { getContractAddress } from "../../utils/helpers";

/**
 * @author Yassine
 * @title Hook: Oracle Price
 * @notice Retrieve price of asset from Opyn Oracle
 * @dev This is mainly used for the price of the underlying asset
 * @dev A better approach would be to use useContractRead
 */
const useOraclePrice = () => {
  // Addresses
  const opynOracleAddress = getContractAddress("OpynOracle");

  // Contract read
  const getPrice = async (asset: HexString) => {
    return await readContract({
      address: opynOracleAddress,
      abi: OracleABI,
      functionName: "getPrice",
      args: [asset],
    });
  };

  return [
    getPrice, // retrieve price of asset
  ];
};

export default useOraclePrice;
