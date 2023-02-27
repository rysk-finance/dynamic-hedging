import { init } from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

export const useSentry = () => {
  const appEnv = process.env.REACT_APP_VERCEL_ENV;

  if (appEnv) {
    init({
      attachStacktrace: true,
      dsn: process.env.REACT_APP_SENTRY_DSN,
      environment: `${appEnv}: client`,
      integrations: [new BrowserTracing()],
      release: process.env.REACT_APP_VERCEL_GIT_COMMIT_SHA,
      tracesSampleRate:
        process.env.REACT_APP_VERCEL_ENV === "production" ? 0.05 : 1,

      beforeBreadcrumb: (breadcrumb, hint) => {
        return hint?.level === "warn" ? null : breadcrumb;
      },
    });
  }
};
