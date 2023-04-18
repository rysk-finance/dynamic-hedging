import { readContract } from "@wagmi/core";
import dayjs from "dayjs";
import { useCallback } from "react";

import { PriceFeedABI } from "src/abis/PriceFeed_ABI";
import { fromOpynToNumber } from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { logError } from "src/utils/logError";
import { CMC_API_KEY, endpoints } from "../config/endpoints";
import { useGlobalContext } from "../state/GlobalContext";
import { ActionType } from "../state/types";

interface EthPriceResponse {
  current_price: number;
  price_change_percentage_24h: number;
  high_24h: number;
  low_24h: number;
}

export const priceFeedGetRate = async () => {
  const ethPrice = await readContract({
    address: getContractAddress("priceFeed"),
    abi: PriceFeedABI,
    functionName: "getRate",
    args: [getContractAddress("WETH"), getContractAddress("USDC")],
  });

  return fromOpynToNumber(ethPrice);
};

/**
 * Hook to update Ether price in global state.
 *
 * To update the Ether price along with historical data
 * you can call updatePriceData.
 *
 * To explicitly update jus the Ether price you
 * can call updatePrice.
 *
 * @returns { updatePriceData, updatePrice }
 */
export const useUpdateEthPrice = () => {
  const { dispatch } = useGlobalContext();

  const getCoinGeckoPriceData = async () => {
    try {
      const response = await fetch(endpoints.ethPrice, {
        headers: {
          "X-CMC_PRO_API_KEY": CMC_API_KEY,
          Accept: "application/json",
        },
      });
      const data: EthPriceResponse[] = await response.json();
      return data[0];
    } catch (error) {
      logError(error);
    }
  };

  const getPriceFeedRate = async () => {
    try {
      return await priceFeedGetRate();
    } catch (error) {
      logError(error);

      dispatch({
        type: ActionType.SET_ETH_PRICE_ERROR,
        error: true,
      });
    }
  };

  const updatePriceData = useCallback(async () => {
    const ethPriceData = await getCoinGeckoPriceData();
    const ethPrice = await getPriceFeedRate();

    if (ethPriceData) {
      dispatch({
        type: ActionType.SET_ETH_PRICE,
        price: ethPrice || ethPriceData.current_price,
        change: ethPriceData.price_change_percentage_24h,
        date: dayjs().toDate(),
        high: ethPriceData.high_24h,
        low: ethPriceData.low_24h,
        error: false,
      });
    } else if (ethPrice) {
      dispatch({
        type: ActionType.SET_ETH_PRICE,
        price: ethPrice,
        date: dayjs().toDate(),
        error: false,
      });
    } else {
      dispatch({
        type: ActionType.SET_ETH_PRICE_ERROR,
        error: true,
      });
    }
  }, [dispatch]);

  const updatePrice = useCallback(async () => {
    const ethPrice = await getPriceFeedRate();

    if (ethPrice) {
      dispatch({
        type: ActionType.SET_ETH_PRICE,
        price: ethPrice,
        date: dayjs().toDate(),
        error: false,
      });
    }
  }, [dispatch]);

  return { updatePriceData, updatePrice } as const;
};
