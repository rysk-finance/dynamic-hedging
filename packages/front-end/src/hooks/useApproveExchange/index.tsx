import { useState, useEffect } from "react";
import { useAccount, useContractWrite, usePrepareContractWrite } from "wagmi";
import { getNetwork, readContract } from "@wagmi/core";
import addresses from "../../contracts.json";
import { ETHNetwork } from "../../types";
import OpynControllerABI from "../../abis/OpynController.json";

const useApproveExchange = (): [
  ((overrideConfig?: undefined) => void) | undefined,
  boolean | null
] => {
  // Global state
  const { chain } = getNetwork();
  const { address } = useAccount();
  const network = chain?.network as ETHNetwork;
  const controllerAddress = addresses[network].OpynController;
  const exchangeAddress = addresses[network].optionExchange;

  // Internal state
  // note - stores true but in the future we want to allow user to remove operator status
  const [isOperator] = useState<boolean>(true);
  // note - this is to store isOperator response from Controller
  const [isApproved, setIsApproved] = useState<boolean | null>(null);

  // Contract read
  useEffect(() => {
    const readIsOperator = async () => {
      const current = await readContract({
        address: controllerAddress as `0x${string}`, // TODO update after rebasing Tim's branch
        abi: OpynControllerABI,
        functionName: "isOperator",
        args: [address, exchangeAddress],
      });

      setIsApproved(current as boolean);
    };

    readIsOperator().catch(console.log);
    // note - only address can change here, the rest not because we don't allow network change
  }, [address, exchangeAddress, controllerAddress]);

  // Contract write
  const { config } = usePrepareContractWrite({
    address: controllerAddress as `0x${string}`, // TODO update after rebasing Tim's branch
    abi: OpynControllerABI,
    functionName: "setOperator",
    args: [exchangeAddress, isOperator],
  });

  const { write } = useContractWrite(config);

  // interface

  return [write, isApproved];
};

export default useApproveExchange;
