import { captureException, setUser } from "@sentry/react";
import { getAccount } from "@wagmi/core";

export const logError = (error: unknown) => {
  console.error(error);

  if (process.env.NODE_ENV !== "development") {
    const { address } = getAccount();
    setUser({
      ip_address: "0.0.0.0",
      username: address ? address.toLowerCase() : undefined,
    });
    captureException(error);
  }
};
