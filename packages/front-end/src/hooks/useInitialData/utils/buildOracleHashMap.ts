import type { WethOracleHashMap } from "src/state/types";
import type { OraclePrices } from "../types";

import { fromOpynToNumber } from "src/utils/conversion-helper";
import { logError } from "src/utils/logError";

export const buildOracleHashMap = (oracleAsset: OraclePrices) => {
  try {
    return oracleAsset.prices.reduce((map, { expiry, price }) => {
      map[expiry] = fromOpynToNumber(price);

      return map;
    }, {} as WethOracleHashMap);
  } catch (error) {
    logError(error);

    return {};
  }
};
