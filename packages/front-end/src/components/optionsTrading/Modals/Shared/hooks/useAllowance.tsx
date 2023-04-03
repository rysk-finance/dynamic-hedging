import type { AllowanceState } from "../types";

import { readContract } from "@wagmi/core";
import { BigNumber } from "ethers";
import { useEffect, useState } from "react";
import { erc20ABI } from "src/abis/erc20_ABI";
import { getContractAddress } from "src/utils/helpers";

const exchangeAddress = getContractAddress("optionExchange");

/**
 * Hook to retrieve the users allowance for an ERC20 token.
 * Returns a getter, setter state pair for the allowance.
 *
 * @param props - { tokenAddress: HexString; userAddress?: HexString; }
 * @returns [allowance, setAllowance]
 */
export const useAllowance = (
  tokenAddress?: HexString,
  userAddress?: HexString
) => {
  const [allowance, setAllowance] = useState<AllowanceState>({
    approved: false,
    amount: BigNumber.from(0),
  });

  useEffect(() => {
    const checkApproval = async () => {
      if (tokenAddress && userAddress) {
        const amount = await readContract({
          address: tokenAddress,
          abi: erc20ABI,
          functionName: "allowance",
          args: [userAddress, exchangeAddress],
        });

        setAllowance((currentState) => ({ ...currentState, amount }));
      }
    };

    checkApproval();
  }, [userAddress, allowance.approved, tokenAddress]);

  return [allowance, setAllowance] as const;
};
