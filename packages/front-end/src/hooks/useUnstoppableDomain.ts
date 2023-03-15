import { captureException } from "@sentry/react";
import { Resolution } from "@unstoppabledomains/resolution";
import { getAccount } from "@wagmi/core";
import { useEffect } from "react";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

export const resolution = new Resolution();

export const useUnstoppableDomain = () => {
  const { dispatch } = useGlobalContext();

  const { address } = getAccount();

  useEffect(() => {
    const getDomain = async () => {
      try {
        if (address) {
          const domain = await resolution.reverse(address);

          if (domain) {
            dispatch({
              type: ActionType.SET_UNSTOPPABLE_DOMAIN,
              unstoppableDomain:
                domain.length > 24 ? `${domain.substring(0, 24)}...` : domain,
            });
          }
        }
      } catch (error) {
        captureException(error);

        dispatch({
          type: ActionType.SET_UNSTOPPABLE_DOMAIN,
          unstoppableDomain: null,
        });
      }
    };

    getDomain();
  }, [address]);
};
