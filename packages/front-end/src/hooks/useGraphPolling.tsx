import { useEffect } from "react";

/**
 * Custom polling interval hook that works in React strict-mode.
 *
 * @param data - The data returned from an initial graph query.
 * @param startPolling - The startPolling function returned from the same query.
 * @param interval - The polling interval in ms, defaults to 15000ms.
 */
export const useGraphPolling = (
  data: any,
  startPolling: (interval: number) => void,
  interval: number = 15000
) => {
  useEffect(() => {
    if (data) {
      startPolling(interval);
    }
  }, [data]);
};
