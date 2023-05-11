import { captureException } from "@sentry/react";

export const logError = (error: any) => {
  console.error(error);

  if (process.env.NODE_ENV !== "development") {
    if (typeof error === "object" && "message" in error) {
      captureException(error.message);
    } else {
      captureException(error);
    }
  }
};
