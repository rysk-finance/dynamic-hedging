import type { PropsWithChildren } from "react";

import { TERMS_LINK } from "src/config/links";
import { useGlobalContext } from "src/state/GlobalContext";

export const Disclaimer = ({ children }: PropsWithChildren) => {
  const {
    state: {
      geoData: { blocked, country },
    },
  } = useGlobalContext();

  const color = blocked ? "text-red-500" : "text-gray-600";

  return (
    <small className={`block text-center p-4 ${color}`}>
      {blocked ? (
        <>
          {`Trading is not available for people or entities in ${
            country || "your country"
          } and other restricted jurisdictions. Learn more in our `}
          <a
            href={TERMS_LINK}
            className={`!${color} underline`}
            rel="noreferrer noopener"
            target="_blank"
          >
            {`terms of service.`}
          </a>
        </>
      ) : (
        <>{children}</>
      )}
    </small>
  );
};
