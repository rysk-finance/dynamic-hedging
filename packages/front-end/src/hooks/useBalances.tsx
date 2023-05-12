import { fetchBalance } from "@wagmi/core";
import { useAccount } from "wagmi";

import {
  fromRyskToNumber,
  tFormatUSDC,
  truncate,
} from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { useEffect } from "react";

const getBalances = async (address?: HexString) => {
  if (!address) {
    return {
      ETH: 0,
      USDC: 0,
      WETH: 0,
    };
  }

  const { value: balanceETH } = await fetchBalance({
    address: address,
  });
  const { value: balanceUSDC } = await fetchBalance({
    address: address,
    token: getContractAddress("USDC"),
  });
  const { value: balanceWETH } = await fetchBalance({
    address: address,
    token: getContractAddress("WETH"),
  });

  return {
    ETH: truncate(fromRyskToNumber(balanceETH.toString()), 4),
    USDC: truncate(tFormatUSDC(balanceUSDC), 2),
    WETH: truncate(fromRyskToNumber(balanceWETH.toString()), 4),
  };
};

/**
 * Hook to get the Eth, USDC and WETH balances for an address.
 * Returns a zero balance for each asset if no address is supplied.
 *
 * @param address - User wallet address.
 * @returns Keyed object of user balances by token name.
 */
export const useBalances = () => {
  const { address } = useAccount();

  const { dispatch } = useGlobalContext();

  useEffect(() => {
    getBalances(address).then((balances) => {
      dispatch({ type: ActionType.SET_USER_BALANCES, balances });
    });
  }, [address]);
};
