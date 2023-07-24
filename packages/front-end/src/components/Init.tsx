import { useBalances } from "src/hooks/useBalances";
import useFathom from "src/hooks/useFathom";
import { useGeoBlock } from "src/hooks/useGeoBlock/useGeoBlock";
import { useInitialData } from "src/hooks/useInitialData";
import { useSentry } from "src/hooks/useSentry";
import { useEthUsdPriceChangeHandler } from "src/hooks/useEthUsdPriceChangeHandler";

/**
 * Initialiser component to trigger onLoad events:
 * - Initialise Sentry.
 * - Initialise Fathom.

 * - Initialise user geo-blocking.
 * - Initialise user balances.
 * - Initialise state with graph and contract data.
 * - Initialise listener for Ether price change evebts from the aggregator.
 *
 * @returns void
 */
export const Init = () => {
  useFathom();
  useSentry();

  useGeoBlock();
  useEthUsdPriceChangeHandler();
  useBalances();
  useInitialData();

  return null;
};
