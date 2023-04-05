import { fetchBalance } from "@wagmi/core";

import { getContractAddress } from "src/utils/helpers";
import { tFormatUSDC, fromRyskToNumber } from "src/utils/conversion-helper";

/**
 * Get the USDC and WETH balances for an address as an integer.
 * Returns a zero balance for each asset is no address is supplied.
 *
 * @param address - User wallet address.
 * @returns Keyed object of user balances by token name.
 */
export const getBalancesAsInteger = async (address?: HexString) => {
  if (!address) {
    return {
      USDC: 0,
      WETH: 0,
    };
  }

  const { value: balanceUSDC } = await fetchBalance({
    address: address,
    token: getContractAddress("USDC"),
  });
  const { value: balanceWETH } = await fetchBalance({
    address: address,
    token: getContractAddress("WETH"),
  });

  return {
    USDC: tFormatUSDC(balanceUSDC),
    WETH: fromRyskToNumber(balanceWETH.toString()),
  };
};
