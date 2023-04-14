import { captureException } from "@sentry/react";

export const logError = (error: unknown) => {
  if (process.env.NODE_ENV === "development") {
    console.error(error);
  } else {
    captureException(error);
  }
};
