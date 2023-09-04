import type { ChainData, UserPositionToken } from "src/state/types";

import dayjs from "dayjs";

import { fromWeiToInt } from "src/utils/conversion-helper";
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
    (totalDelta, { expiryTimestamp, isPut, strikePrice, netAmount }) => {
      const isOpen = parseInt(expiryTimestamp) > nowToUnix;
      const side = isPut ? "put" : "call";
      const size = fromWeiToInt(netAmount);
      const strike = Convert.fromOpyn(strikePrice).toInt;
      const chainDataDelta = chainData[expiryTimestamp]?.[strike][side]?.delta;
      const delta = isOpen && chainDataDelta ? chainDataDelta : 0;

      return totalDelta + delta * size;
    },
    0
  );
};
