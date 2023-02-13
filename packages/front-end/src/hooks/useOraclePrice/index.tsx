import addresses from "../../contracts.json";
import { ETHNetwork } from "../../types";
import { readContract, getNetwork } from "@wagmi/core";
import OpynOracleABI from "../../abis/opyn/Oracle.json";

const useOraclePrice = () => {
  // TODO: this is repetitive code
  const { chain } = getNetwork();
  const network = chain?.network as ETHNetwork;

  const opynOracleAddress = addresses[network].OpynOracle;

  const getPrice = async (asset: string) => {
    return await readContract({
      address: opynOracleAddress as `0x${string}`, // TODO update after rebasing Tim's branch
      abi: OpynOracleABI,
      functionName: "getPrice",
      args: [asset],
    });
  };

  return [getPrice];
};

export default useOraclePrice;
