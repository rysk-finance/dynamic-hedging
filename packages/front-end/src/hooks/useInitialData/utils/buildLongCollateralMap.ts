import type { LongCollateral, LongCollateralMap } from "../types";

export const buildLongCollateralMap = (
  longCollateral: LongCollateral[]
): LongCollateralMap => {
  return longCollateral.reduce(
    (hashmap: LongCollateralMap, collateralPosition) => {
      hashmap[collateralPosition.vaultId] = collateralPosition;

      return hashmap;
    },
    {}
  );
};
