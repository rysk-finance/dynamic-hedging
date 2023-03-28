import type { PropsWithChildren } from "react";

export const Disclaimer = ({ children }: PropsWithChildren) => (
  <small className="block text-gray-600 p-4">{children}</small>
);
