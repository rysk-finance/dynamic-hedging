import * as ethers from "ethers";
import { useCallback, useEffect, useState } from "react";
import { useWalletContext } from "../App";
import { toast } from "react-toastify";
import { TransactionResponse } from "@ethersproject/abstract-provider";

type useContractArgs = {
  address: string;
  ABI: ethers.ContractInterface;
  readOnly?: boolean;
};

export const useContract = ({
  address,
  ABI,
  readOnly = true,
}: useContractArgs) => {
  const { provider } = useWalletContext();
  const [contract, setContract] = useState<ethers.Contract | null>(null);

  const callWithErrorHandling = useCallback(
    async (method: ethers.ContractFunction, ...args: any) => {
      try {
        const transaction = (await method(...args)) as TransactionResponse;
        await transaction.wait();
        toast(`✅ Transaction successful`);
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
    const signerOrProvider = readOnly ? provider : provider?.getSigner();
    if (signerOrProvider) {
      setContract(new ethers.Contract(address, ABI, signerOrProvider));
    }
  }, [address, ABI, provider, readOnly]);

  return [contract, callWithErrorHandling] as const;
};
