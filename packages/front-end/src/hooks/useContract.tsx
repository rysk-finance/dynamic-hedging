import * as ethers from "ethers";
import { useEffect, useState } from "react";
import { useWalletContext } from "../App";

type useContractArgs = {
  address: string;
  ABI: ethers.ContractInterface;
  readOnly: boolean;
};

export const useContract = ({
  address,
  ABI,
  readOnly = true,
}: useContractArgs) => {
  const { provider } = useWalletContext();
  const [contract, setContract] = useState<ethers.Contract | null>(null);

  useEffect(() => {
    const signerOrProvider = readOnly ? provider : provider?.getSigner();
    if (signerOrProvider) {
      setContract(new ethers.Contract(address, ABI, signerOrProvider));
    }
  }, [address, ABI, provider, readOnly]);

  return [contract];
};
