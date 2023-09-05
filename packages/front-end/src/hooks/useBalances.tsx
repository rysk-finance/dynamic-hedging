import { fetchBalance } from "@wagmi/core";
import { useAccount } from "wagmi";

import { useEffect } from "react";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { Convert } from "src/utils/Convert";
import { getContractAddress } from "src/utils/helpers";

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
    ETH: Convert.fromWei(balanceETH, 2).toInt,
    USDC: Convert.fromUSDC(balanceUSDC, 2).toInt,
    WETH: Convert.fromWei(balanceWETH, 2).toInt,
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

  const {
    dispatch,
    state: {
      options: { userPositions },
    },
  } = useGlobalContext();

  useEffect(() => {
    getBalances(address).then((balances) => {
      dispatch({ type: ActionType.SET_USER_BALANCES, balances });
    });
  }, [address, userPositions]);
};
