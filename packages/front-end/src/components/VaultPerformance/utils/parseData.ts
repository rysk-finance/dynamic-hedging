import type { ChartData, QueryData } from "../VaultPerformance.types";

import { readContracts } from "@wagmi/core";

import { DHVLensMK1ABI } from "src/abis/DHVLensMK1_ABI";
import { PriceFeedABI } from "src/abis/PriceFeed_ABI";
import { Convert } from "src/utils/Convert";
import {
  SECONDS_IN_WEEK,
  fromOpynToNumber,
  fromWeiToInt,
} from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";

export const parseData = async (
  graphData?: QueryData
): Promise<ChartData[] | undefined> => {
  const [currentPricePerShare, currentEthPrice] = await readContracts({
    contracts: [
      {
        abi: DHVLensMK1ABI,
        address: getContractAddress("DHVLens"),
        functionName: "getCurrentPricePerShare",
      },
      {
        abi: PriceFeedABI,
        address: getContractAddress("priceFeed"),
        functionName: "getRate",
        args: [getContractAddress("WETH"), getContractAddress("USDC")],
      },
    ],
  });

  if (graphData) {
    const { pricePerShares } = graphData;
    const lastIndex = pricePerShares[pricePerShares.length - 1];

    const currentPPS = fromWeiToInt(currentPricePerShare[0] || lastIndex.value);
    const lastPPS = fromWeiToInt(lastIndex.value);
    const diff = (currentPPS - lastPPS) * 100;
    const lastGrowthCalculation = parseFloat(lastIndex.growthSinceFirstEpoch);
    const predictedGrowthSinceFirstEpoch = String(lastGrowthCalculation + diff);

    const pricePerSharesWithPrediction = [
      ...pricePerShares,
      {
        epoch: (parseFloat(lastIndex.epoch) + 1).toString(),
        ethPrice: currentEthPrice,
        growthSinceFirstEpoch: "",
        predictedGrowthSinceFirstEpoch,
        timestamp: String(parseInt(lastIndex.timestamp) + SECONDS_IN_WEEK),
        value: currentPricePerShare.toString(),
        __typename: "",
      },
    ];

    const publicLaunchOffset = pricePerSharesWithPrediction.length
      ? parseFloat(pricePerSharesWithPrediction[0].growthSinceFirstEpoch)
      : 0;
    const publicLaunchEthPrice = pricePerSharesWithPrediction.length
      ? fromOpynToNumber(pricePerSharesWithPrediction[0].ethPrice)
      : 0;

    return pricePerSharesWithPrediction.map((pricePoint, index, array) => {
      const pricePointGrowth = parseFloat(pricePoint.growthSinceFirstEpoch);
      const growthSinceFirstEpoch = Convert.round(
        pricePointGrowth - publicLaunchOffset
      );

      const ethPrice = fromOpynToNumber(pricePoint.ethPrice);
      const ethPriceGrowth = Convert.round(
        (ethPrice / publicLaunchEthPrice - 1) * 100
      );

      if (pricePoint.predictedGrowthSinceFirstEpoch) {
        const predictedPricePointGrowth = parseFloat(
          pricePoint.predictedGrowthSinceFirstEpoch
        );

        return {
          ...pricePoint,
          ethPrice: NaN,
          predictedEthPrice: ethPriceGrowth,
          growthSinceFirstEpoch: NaN,
          predictedGrowthSinceFirstEpoch: Convert.round(
            predictedPricePointGrowth - publicLaunchOffset
          ),
          isPrediction: true,
        };
      }

      if (index === array.length - 2) {
        return {
          ...pricePoint,
          ethPrice: ethPriceGrowth,
          predictedEthPrice: ethPriceGrowth,
          growthSinceFirstEpoch,
          predictedGrowthSinceFirstEpoch: growthSinceFirstEpoch,
          isPrediction: false,
        };
      }

      return {
        ...pricePoint,
        ethPrice: ethPriceGrowth,
        predictedEthPrice: null,
        growthSinceFirstEpoch,
        predictedGrowthSinceFirstEpoch: null,
        isPrediction: false,
      };
    });
  }
};
