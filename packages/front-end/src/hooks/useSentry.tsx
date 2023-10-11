import { init, setUser } from "@sentry/react";
import { useEffect } from "react";
import { useAccount } from "wagmi";

export const useSentry = () => {
  const { address } = useAccount();
  const appEnv = process.env.REACT_APP_VERCEL_ENV;

  useEffect(() => {
    setUser({
      ip_address: "0.0.0.0",
    });

    if (address) {
      setUser({
        ip_address: "0.0.0.0",
        username: address.toLowerCase(),
      });
    }
  }, [address]);

  useEffect(() => {
    if (appEnv) {
      init({
        attachStacktrace: true,
        dsn: process.env.REACT_APP_SENTRY_DSN,
        environment: `${appEnv}: client`,
        ignoreErrors: [
          /Error: Failed to fetch/,
          /TypeError: Failed to fetch/,
          /TypeError: Network request failed/,
          /TypeError: Load failed/,
          /ApolloError: Failed to fetch/,
          /ApolloError: Load failed/,
          /ApolloError: Store error: database unavailable/,
          /The operation was aborted/,
          /NetworkError when attempting to fetch resource/,
          /user rejected transaction/,
          /ChunkLoadError/,
          /STALE_PRICE/,
          /NONCE_EXPIRED/,
          /@walletconnect/,
          /relay.walletconnect.org/,
          /ResolutionError/,
          /@coinbase/,
          /ConnectorNotFoundError/,
          /EvalError/,
          /chrome-extension/,
          "NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.",
          "NotFoundError: Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.",
        ],
        release: process.env.REACT_APP_VERCEL_GIT_COMMIT_SHA,
        tracesSampleRate:
          process.env.REACT_APP_VERCEL_ENV === "production" ? 0.05 : 1,

        beforeBreadcrumb: (breadcrumb, hint) => {
          return hint?.level === "warn" ? null : breadcrumb;
        },
      });
    }
  }, [appEnv]);
};
