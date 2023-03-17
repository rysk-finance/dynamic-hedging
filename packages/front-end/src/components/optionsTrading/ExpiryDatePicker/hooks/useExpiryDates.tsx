import type { VisibleRange } from "../types";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

/**
 * Hook to set visible expiry dates for the options chain
 * and allow pagination between them.
 * Sets selected expiry based on query params if present.
 *
 * @property visibleRange - A tuple representing the visible index range of the expiryDates list.
 * @property handleExpirySelection - Handler function for selecting an option expiry.
 * @property scrollExpiries - A function to move the visible index of expiry dates.
 *
 * @returns [VisibleRange, (date: number) => () => void, (direction: 1 | -1) => () => void]
 */
export const useExpiryDates = () => {
  const [searchParams] = useSearchParams();

  const queryExpiry = searchParams.get("expiry");

  const {
    state: {
      options: { expiries },
    },
    dispatch,
  } = useGlobalContext();

  const [visibleRange, setVisibleRange] = useState<VisibleRange>([0, 0]);

  const setExpiryDate = useCallback(
    (activeExpiry: string) => {
      dispatch({ type: ActionType.SET_OPTIONS, activeExpiry });
    },
    [dispatch]
  );

  const handleExpirySelection = (activeExpiry: string) => () =>
    setExpiryDate(activeExpiry);

  const scrollExpiries = (direction: 1 | -1) => () =>
    setVisibleRange(([currentMin, currentMax]) => [
      currentMin + direction,
      currentMax + direction,
    ]);

  useEffect(() => {
    if (queryExpiry && expiries.includes(queryExpiry)) {
      const index = expiries.indexOf(queryExpiry);

      setExpiryDate(expiries[index]);
    }

    setVisibleRange([0, Math.min(3, expiries.length - 1)]);
  }, [queryExpiry, expiries]);

  return [visibleRange, handleExpirySelection, scrollExpiries] as const;
};
