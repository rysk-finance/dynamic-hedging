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

  if (appEnv) {
    init({
      attachStacktrace: true,
      dsn: process.env.REACT_APP_SENTRY_DSN,
      environment: `${appEnv}: client`,
      ignoreErrors: [
        /TypeError: Failed to fetch/,
        /TypeError: Network request failed/,
        /TypeError: Load failed/,
        /ApolloError: Failed to fetch/,
        /ApolloError: Load failed/,
        /Non-Error exception captured/,
        /NetworkError when attempting to fetch resource/,
      ],
      release: process.env.REACT_APP_VERCEL_GIT_COMMIT_SHA,
      tracesSampleRate:
        process.env.REACT_APP_VERCEL_ENV === "production" ? 0.05 : 1,

      beforeBreadcrumb: (breadcrumb, hint) => {
        return hint?.level === "warn" ? null : breadcrumb;
      },
    });
  }
};
