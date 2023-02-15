import { useState, useEffect } from "react";
import { useAccount, useContractWrite, usePrepareContractWrite } from "wagmi";
import { readContract } from "@wagmi/core";
import OpynControllerABI from "../../abis/OpynController.json";
import { getContractAddress } from "../../utils/helpers";

const useApproveExchange = (): [
  ((overrideConfig?: undefined) => void) | undefined,
  boolean | null
] => {
  // Global state
  const { address } = useAccount();

  // Addresses
  const controllerAddress = getContractAddress("OpynController");
  const exchangeAddress = getContractAddress("optionExchange");

  // Internal state
  // note - stores true but in the future we want to allow user to remove operator status
  const [isOperator] = useState<boolean>(true);
  // note - this is to store isOperator response from Controller
  const [isApproved, setIsApproved] = useState<boolean | null>(null);

  // Contract read
  useEffect(() => {
    const readIsOperator = async () => {
      const current = await readContract({
        address: controllerAddress,
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
    address: controllerAddress,
    abi: OpynControllerABI,
    functionName: "setOperator",
    args: [exchangeAddress, isOperator],
  });

  const { write } = useContractWrite(config);

  console.log("Is approved: ", isApproved);

  // interface

  return [write, isApproved];
};

export default useApproveExchange;
