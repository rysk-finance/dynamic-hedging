import { captureException } from "@sentry/react";

export const logError = (error: unknown) => {
  console.error(error);

  if (process.env.NODE_ENV !== "development") {
    captureException(error);
  }
};
