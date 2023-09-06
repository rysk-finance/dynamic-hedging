import type { WethOracleHashMap } from "src/state/types";
import type { OraclePrices } from "../types";

import { Convert } from "src/utils/Convert";
import { logError } from "src/utils/logError";

export const buildOracleHashMap = (oracleAsset: OraclePrices) => {
  try {
    return oracleAsset.prices.reduce((map, { expiry, price }) => {
      map[expiry] = Convert.fromOpyn(price).toInt();

      return map;
    }, {} as WethOracleHashMap);
  } catch (error) {
    logError(error);

    return {};
  }
};
