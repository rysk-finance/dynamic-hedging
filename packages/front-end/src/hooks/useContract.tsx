import * as ethers from "ethers";
import { useCallback, useEffect, useState } from "react";
import { useWalletContext } from "../App";
import { toast } from "react-toastify";
import { TransactionResponse } from "@ethersproject/abstract-provider";
import addresses from "../contracts.json";
import { ContractAddresses, ETHNetwork } from "../types";

type useContractRyskContractArgs = {
  contract: keyof ContractAddresses;
  ABI: ethers.ContractInterface;
  readOnly?: boolean;
};

type useContractExternalContractArgs = {
  contractAddress: string;
  ABI: ethers.ContractInterface;
  readOnly?: boolean;
};

type useContractArgs =
  | useContractRyskContractArgs
  | useContractExternalContractArgs;

export const useContract = (args: useContractArgs) => {
  const [network] = useState(
    process.env.REACT_APP_NETWORK as keyof typeof addresses | undefined
  );
  const { provider } = useWalletContext();
  const [ethersContract, setEthersContract] = useState<ethers.Contract | null>(
    null
  );

  const callWithErrorHandling = useCallback(
    async ({
      method,
      args,
      successMessage: successMessage = "✅ Transaction successful",
      onComplete,
    }: {
      method: ethers.ContractFunction;
      args: any[];
      successMessage?: string;
      onComplete?: () => void;
    }) => {
      try {
        const transaction = (await method(...args)) as TransactionResponse;
        await transaction.wait();
        toast(successMessage);
        onComplete?.();
        return;
      } catch (err) {
        try {
          // Might need to modify this is errors other than RPC errors are being thrown
          // my contract function calls.
          toast(`❌ ${(err as any).data.message}`, {
            autoClose: 5000,
          });
          return null;
        } catch {
          toast(JSON.stringify(err));
          return null;
        }
      }
    },
    []
  );

  useEffect(() => {
    const signerOrProvider = args.readOnly ? provider : provider?.getSigner();
    if (signerOrProvider && network && !ethersContract) {
      const address =
        "contract" in args
          ? (addresses as Record<ETHNetwork, ContractAddresses>)[network][
              (args as useContractRyskContractArgs).contract
            ]
          : (args as useContractExternalContractArgs).contractAddress;
      setEthersContract(
        new ethers.Contract(address, args.ABI, signerOrProvider)
      );
    }
  }, [args, provider, network, ethersContract]);

  return [ethersContract, callWithErrorHandling] as const;
};
