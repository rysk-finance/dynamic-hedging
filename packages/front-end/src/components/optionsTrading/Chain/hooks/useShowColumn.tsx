import type { ColumNames } from "src/state/types";

import { useGlobalContext } from "src/state/GlobalContext";

import { useCallback } from "react";

/**
 * Option chain column size and visibility hook.
 *
 * @returns [
 *    colSize - Amount of total columns for the chain.
 *    sideSize - Amount of columns per side (call/put).
 *    showCol - Function to determine if a column is visible.
 * ]
 */
export const useShowColumn = () => {
  const {
    state: { visibleColumns },
  } = useGlobalContext();

  const colSize = visibleColumns.size * 2 + 1;
  const sideSize = visibleColumns.size;
  const showCol = useCallback(
    (columnName: ColumNames) => visibleColumns.has(columnName),
    [visibleColumns]
  );

  return [colSize, sideSize, showCol] as const;
};
