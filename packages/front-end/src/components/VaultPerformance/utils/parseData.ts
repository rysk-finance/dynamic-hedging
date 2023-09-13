import type { ChartData, QueryData } from "../VaultPerformance.types";

import { readContracts } from "@wagmi/core";

import { DHVLensMK1ABI } from "src/abis/DHVLensMK1_ABI";
import { PriceFeedABI } from "src/abis/PriceFeed_ABI";
import { Convert } from "src/utils/Convert";
import { getContractAddress } from "src/utils/helpers";
import { SECONDS_IN_WEEK } from "src/utils/time";

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

    const currentPPS = Convert.fromWei(
      currentPricePerShare[0] || lastIndex.value
    );
    const lastPPS = Convert.fromWei(lastIndex.value).toInt();
    const diff = (currentPPS.toInt() - lastPPS) * 100;
    const lastGrowthCalculation = Convert.fromStr(
      lastIndex.growthSinceFirstEpoch
    ).toInt();
    const predictedGrowthSinceFirstEpoch = Convert.fromInt(
      lastGrowthCalculation + diff
    ).toStr();

    const pricePerSharesWithPrediction = [
      ...pricePerShares,
      {
        epoch: Convert.fromInt(
          Convert.fromStr(lastIndex.epoch).toInt() + 1
        ).toStr(),
        ethPrice: currentEthPrice.toString(),
        growthSinceFirstEpoch: "",
        predictedGrowthSinceFirstEpoch,
        timestamp: String(
          Convert.fromStr(lastIndex.timestamp).toInt() + SECONDS_IN_WEEK
        ),
        value: currentPPS.toStr(),
        __typename: "",
      },
    ];

    const publicLaunchOffset = pricePerSharesWithPrediction.length
      ? Convert.fromStr(
          pricePerSharesWithPrediction[0].growthSinceFirstEpoch
        ).toInt()
      : 0;
    const publicLaunchEthPrice = pricePerSharesWithPrediction.length
      ? Convert.fromOpyn(pricePerSharesWithPrediction[0].ethPrice).toInt()
      : 0;

    return pricePerSharesWithPrediction.map((pricePoint, index, array) => {
      const previousIndex = array[index ? index - 1 : index];

      const previousPricePointGrowth = Convert.fromStr(
        previousIndex.growthSinceFirstEpoch
      ).toInt();
      const pricePointGrowth = Convert.fromStr(
        pricePoint.growthSinceFirstEpoch
      ).toInt();
      const growthSinceFirstEpoch = Convert.round(
        pricePointGrowth - publicLaunchOffset
      );
      const epochWeeklyChange = Convert.round(
        growthSinceFirstEpoch - (previousPricePointGrowth - publicLaunchOffset)
      );

      const previousEthPrice = Convert.fromOpyn(previousIndex.ethPrice).toInt();
      const ethPrice = Convert.fromOpyn(pricePoint.ethPrice).toInt();
      const ethPriceGrowth = Convert.round(
        (ethPrice / publicLaunchEthPrice - 1) * 100
      );
      const ethWeeklyChange = Convert.round(
        ethPriceGrowth - (previousEthPrice / publicLaunchEthPrice - 1) * 100
      );

      if (pricePoint.predictedGrowthSinceFirstEpoch) {
        const predictedPricePointGrowth = Convert.fromStr(
          pricePoint.predictedGrowthSinceFirstEpoch
        ).toInt();
        const predictedGrowthSinceFirstEpoch = Convert.round(
          predictedPricePointGrowth - publicLaunchOffset
        );
        const epochWeeklyChange = Convert.round(
          predictedGrowthSinceFirstEpoch -
            (previousPricePointGrowth - publicLaunchOffset)
        );

        return {
          ...pricePoint,
          ethPrice: NaN,
          predictedEthPrice: ethPriceGrowth,
          ethWeeklyChange,
          growthSinceFirstEpoch: NaN,
          predictedGrowthSinceFirstEpoch,
          epochWeeklyChange,
          isPrediction: true,
        };
      }

      if (index === array.length - 2) {
        return {
          ...pricePoint,
          ethPrice: ethPriceGrowth,
          predictedEthPrice: ethPriceGrowth,
          ethWeeklyChange,
          growthSinceFirstEpoch,
          predictedGrowthSinceFirstEpoch: growthSinceFirstEpoch,
          epochWeeklyChange,
          isPrediction: false,
        };
      }

      return {
        ...pricePoint,
        ethPrice: ethPriceGrowth,
        predictedEthPrice: null,
        ethWeeklyChange,
        growthSinceFirstEpoch,
        predictedGrowthSinceFirstEpoch: null,
        epochWeeklyChange,
        isPrediction: false,
      };
    });
  }
};
