import dayjs from "dayjs";
import { useCallback } from "react";
import { readContract } from "@wagmi/core";

import { CMC_API_KEY, endpoints } from "../config/endpoints";
import { useGlobalContext } from "../state/GlobalContext";
import { ActionType } from "../state/types";
import { PriceFeedABI } from "src/abis/PriceFeed_ABI";
import { getContractAddress } from "src/utils/helpers";
import { fromOpynToNumber } from "src/utils/conversion-helper";
import { captureException } from "@sentry/react";

interface EthPriceResponse {
  current_price: number;
  price_change_percentage_24h: number;
  high_24h: number;
  low_24h: number;
}

export const useUpdateEthPrice = () => {
  const { dispatch } = useGlobalContext();

  const getPrice = async () => {
    const response = await fetch(endpoints.ethPrice, {
      headers: {
        "X-CMC_PRO_API_KEY": CMC_API_KEY,
        Accept: "application/json",
      },
    });
    const data: EthPriceResponse[] = await response.json();

    return data[0];
  };

  const updatePrice = useCallback(async () => {
    try {
      const priceData = await getPrice();

      if (priceData) {
        dispatch({
          type: ActionType.SET_ETH_PRICE,
          price: priceData.current_price,
          change: priceData.price_change_percentage_24h,
          date: dayjs().toDate(),
          high: priceData.high_24h,
          low: priceData.low_24h,
          error: false,
        });
      } else {
        const ethPrice = await readContract({
          address: getContractAddress("priceFeed"),
          abi: PriceFeedABI,
          functionName: "getRate",
          args: [getContractAddress("WETH"), getContractAddress("USDC")],
        });

        if (ethPrice) {
          dispatch({
            type: ActionType.SET_ETH_PRICE,
            price: fromOpynToNumber(ethPrice),
            date: dayjs().toDate(),
            error: false,
          });
        }
      }
    } catch (error) {
      captureException(error);

      dispatch({
        type: ActionType.SET_ETH_PRICE_ERROR,
        error: true,
      });
    }
  }, [dispatch]);

  return { updatePrice };
};
