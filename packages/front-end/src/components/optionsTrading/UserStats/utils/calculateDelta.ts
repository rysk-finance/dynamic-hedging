import type { ChainData, UserPositionToken } from "src/state/types";

import dayjs from "dayjs";

import { Convert } from "src/utils/Convert";

/**
 * Calculate delta value for all active positions.
 *
 * @param chainData - Option chain data from global state.
 * @param positions - List of active user positions.
 *
 * @returns number
 */
export const calculateDelta = (
  chainData: ChainData,
  positions: UserPositionToken[] = []
): number => {
  if (positions.length === 0) return 0;

  const nowToUnix = dayjs().unix();

  return positions.reduce(
    (totalDelta, { expiryTimestamp, isPut, strikePrice, netAmount, vault }) => {
      const expiryData = chainData[expiryTimestamp];
      const vaultOtoken = vault?.longCollateral?.oToken;

      const isOpen = Convert.fromStr(expiryTimestamp).toInt() > nowToUnix;
      const side = isPut ? "put" : "call";
      const size = Convert.fromWei(netAmount).toInt();
      const strike = Convert.fromOpyn(strikePrice).toInt();
      const dataDelta = expiryData?.[strike][side]?.delta;
      const delta = isOpen && dataDelta ? dataDelta : 0;

      totalDelta += delta * size;

      if (vaultOtoken) {
        const vaultSide = vaultOtoken.isPut ? "put" : "call";
        const vaultStrike = Convert.fromOpyn(vaultOtoken.strikePrice).toInt();
        const vaultDataDelta = expiryData?.[vaultStrike][vaultSide]?.delta;
        const vaultDelta = isOpen && vaultDataDelta ? vaultDataDelta : 0;

        totalDelta += vaultDelta * Math.abs(size);
      }

      return totalDelta;
    },
    0
  );
};
