import { getContractAddress } from "src/utils/helpers";
import { useContractEvent, useContractRead } from "wagmi";
import { AggregatorV3ABI } from "src/abis/chainlink/AggregatorV3__ABI";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { EACAggregatorProxyABI } from "src/abis/chainlink/EACAggregatorProxy__ABI";

export const useEthUsdPriceChangeHandler = () => {
  const {
    dispatch,
    state: {
      options: { refresh },
    },
  } = useGlobalContext();

  const { data: aggregatorAddress } = useContractRead({
    abi: EACAggregatorProxyABI,
    functionName: "aggregator",
    address: getContractAddress("ETHUSDAggregator"),
  });

  useContractEvent({
    address: aggregatorAddress,
    abi: AggregatorV3ABI,
    eventName: "AnswerUpdated",
    listener: (_, __, updatedAt) => {
      dispatch({
        type: ActionType.SET_ETH_PRICE_LAST_UPDATED,
        timestamp: updatedAt.toNumber(),
      });
      refresh();
    },
  });
};
