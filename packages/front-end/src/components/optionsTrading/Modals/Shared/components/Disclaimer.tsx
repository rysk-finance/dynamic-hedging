import type { PropsWithChildren } from "react";

import { useGlobalContext } from "src/state/GlobalContext";

export const Disclaimer = ({ children }: PropsWithChildren) => {
  const {
    state: {
      geoData: { blocked, country },
    },
  } = useGlobalContext();

  const color = blocked ? "text-red-500" : "text-gray-600";
  const message = blocked
    ? `Trading is not available for people or entities in ${country} and other restricted jurisdictions. Learn more in our Terms of Use.`
    : children;

  return <small className={`block text-center p-4 ${color}`}>{message}</small>;
};
