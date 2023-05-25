import { Resolution } from "@unstoppabledomains/resolution";
import { getAccount } from "@wagmi/core";
import { useEffect } from "react";
import { mainnet, polygon } from "wagmi/chains";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { logError } from "src/utils/logError";

const [L1, L2] = [mainnet, polygon].map(
  (network) =>
    `${network.rpcUrls.alchemy.http}/${process.env.REACT_APP_ALCHEMY_KEY}/`
);

const resolution = new Resolution({
  sourceConfig: {
    uns: {
      locations: {
        Layer1: {
          url: L1,
          network: "mainnet",
        },
        Layer2: {
          url: L2,
          network: "polygon-mainnet",
        },
      },
    },
  },
});

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
        logError(error);

        dispatch({
          type: ActionType.SET_UNSTOPPABLE_DOMAIN,
          unstoppableDomain: null,
        });
      }
    };

    getDomain();
  }, [address]);
};
