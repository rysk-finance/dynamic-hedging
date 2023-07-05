import { waitForTransaction } from "@wagmi/core";

/**
 * Wait for x confirmations or x milliseconds after a transaction before continuing.
 *
 * @param hash  - Hash of the TX to check.
 * @param confirmations - Minimum confirmations to wait for (defaults to three).
 * @param timerMs - Maximum wait time in milliseconds.
 *
 * @returns Promise<unknown>
 */
export const waitForTransactionOrTimer = async (
  hash: HexString,
  confirmations: number = 12,
  timerMs: number = 15000
): Promise<unknown> => {
  return Promise.race([
    waitForTransaction({ hash, confirmations }),
    new Promise((resolve) => setTimeout(resolve, timerMs)),
  ]);
};
