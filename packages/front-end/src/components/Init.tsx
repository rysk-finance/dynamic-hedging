import { useBalances } from "src/hooks/useBalances";
import useFathom from "src/hooks/useFathom";
import { useInitialData } from "src/hooks/useInitialData";
import { useSentry } from "src/hooks/useSentry";

/**
 * Initialiser component to trigger onLoad events:
 * - Initialise Sentry.
 * - Initialise Fathom.
 * - Initialise state with graph and contract data.
 *
 * @returns void
 */
export const Init = () => {
  useFathom();
  useSentry();

  useBalances();
  useInitialData();

  return null;
};
