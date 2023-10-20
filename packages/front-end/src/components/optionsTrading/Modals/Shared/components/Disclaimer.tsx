import type { PropsWithChildren } from "react";

import { TERMS_LINK } from "src/config/links";
import { useGlobalContext } from "src/state/GlobalContext";

interface DisclaimerProps extends PropsWithChildren {
  closing?: boolean;
}

export const Disclaimer = ({ children, closing }: DisclaimerProps) => {
  const {
    state: {
      geoData: { blocked, country },
    },
  } = useGlobalContext();

  const color = blocked && !closing ? "text-red-500" : "text-gray-600";

  return (
    <small className={`block text-center p-3 ${color}`}>
      {blocked && !closing ? (
        <>
          {`Trading is not available for people or entities in ${
            country || "your country"
          } and other restricted jurisdictions. Learn more in the `}
          <a
            href={TERMS_LINK}
            className={`!${color} underline`}
            rel="noreferrer noopener"
            target="_blank"
          >
            {`Rysk user terms of service.`}
          </a>
        </>
      ) : (
        <>{children}</>
      )}
    </small>
  );
};
