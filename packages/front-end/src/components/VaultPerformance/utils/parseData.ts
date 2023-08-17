import type { ChartData, QueryData } from "../VaultPerformance.types";

import { readContract } from "@wagmi/core";

import { DHVLensMK1ABI } from "src/abis/DHVLensMK1_ABI";
import { getContractAddress } from "src/utils/helpers";
import { toTwoDecimalPlaces } from "src/utils/rounding";

export const parseData = async (
  graphData?: QueryData
): Promise<ChartData[] | undefined> => {
  // Get current PPS from lens.
  const [dummyValue] = await readContract({
    address: getContractAddress("DHVLens"),
    abi: DHVLensMK1ABI,
    functionName: "getExpirations",
  });

  if (graphData) {
    const { pricePerShares } = graphData;
    const lastIndex = pricePerShares[pricePerShares.length - 1];

    const pricePerSharesWithPrediction = [
      ...pricePerShares,
      {
        epoch: (parseFloat(lastIndex.epoch) + 1).toString(),
        growthSinceFirstEpoch: "",
        predictedGrowthSinceFirstEpoch: "-2.291", // Use lens value.
        timestamp: (
          parseFloat(lastIndex.timestamp) + SECONDS_IN_SEVEN_DAYS
        ).toString(),
        __typename: "",
      },
    ];

    const publicLaunchOffset = pricePerSharesWithPrediction.length
      ? parseFloat(pricePerSharesWithPrediction[0].growthSinceFirstEpoch)
      : 0;

    // Values need replacing with API/Chain data.
    const ethPrices = [
      1892.21, 1877.3, 1845.48, 1842.73, 1653.45, 1647.6, 1633.62,
    ];

    return pricePerSharesWithPrediction.map((pricePoint, index, array) => {
      const pricePointGrowth = parseFloat(pricePoint.growthSinceFirstEpoch);
      const growthSinceFirstEpoch = toTwoDecimalPlaces(
        pricePointGrowth - publicLaunchOffset
      );

      if (pricePoint.predictedGrowthSinceFirstEpoch) {
        const predictedPricePointGrowth = parseFloat(
          pricePoint.predictedGrowthSinceFirstEpoch
        );

        return {
          ...pricePoint,
          ethPrice: toTwoDecimalPlaces(
            (ethPrices[index] / ethPrices[0] - 1) * 100
          ),
          growthSinceFirstEpoch: NaN,
          predictedGrowthSinceFirstEpoch: toTwoDecimalPlaces(
            predictedPricePointGrowth - publicLaunchOffset
          ),
        };
      }

      if (index === array.length - 2) {
        return {
          ...pricePoint,
          growthSinceFirstEpoch,
          predictedGrowthSinceFirstEpoch: growthSinceFirstEpoch,
        };
      }

      return {
        ...pricePoint,
        growthSinceFirstEpoch,
        predictedGrowthSinceFirstEpoch: null,
      };
    });
  }
};
