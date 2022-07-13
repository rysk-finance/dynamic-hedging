import Axios from "axios";
import { useCallback } from "react";
import { CMC_API_KEY, endpoints } from "../config/endpoints";
import { useGlobalContext } from "../state/GlobalContext";
import { ActionType } from "../state/types";

type EthPriceResponse = [
  {
    current_price: number;
    price_change_percentage_24h: number;
  }
];

export const useUpdateEthPrice = () => {
  const { dispatch } = useGlobalContext();

  const getPrice = async () => {
    try {
      const response = await Axios.get<EthPriceResponse>(endpoints.ethPrice, {
        headers: {
          "X-CMC_PRO_API_KEY": CMC_API_KEY,
          Accept: "application/json",
        },
      });
      return response.data[0];
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const updatePrice = useCallback(async () => {
    const priceData = await getPrice();
    if (priceData) {
      dispatch({
        type: ActionType.SET_ETH_PRICE,
        price: priceData.current_price,
        change: priceData.price_change_percentage_24h,
        date: new Date(),
      });
    }
  }, [dispatch]);

  return { updatePrice };
};
