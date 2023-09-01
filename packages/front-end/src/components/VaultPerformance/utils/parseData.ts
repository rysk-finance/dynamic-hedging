import type { ChartData, QueryData } from "../VaultPerformance.types";

import { readContracts } from "@wagmi/core";

import { DHVLensMK1ABI } from "src/abis/DHVLensMK1_ABI";
import { PriceFeedABI } from "src/abis/PriceFeed_ABI";
import { fromWeiToInt, fromOpynToNumber } from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { toTwoDecimalPlaces } from "src/utils/rounding";

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
        growthSinceFirstEpoch: "",
        predictedGrowthSinceFirstEpoch,
        timestamp: currentPricePerShare[1].toString(),
        value: currentPricePerShare.toString(),
        __typename: "",
      },
    ];

    const publicLaunchOffset = pricePerSharesWithPrediction.length
      ? parseFloat(pricePerSharesWithPrediction[0].growthSinceFirstEpoch)
      : 0;

    // Values need replacing with API/Chain data.
    const ethPrices = [
      1892.21,
      1877.3,
      1845.48,
      1842.73,
      1653.45,
      1647.6,
      1633.62,
      fromOpynToNumber(currentEthPrice),
    ];

    return pricePerSharesWithPrediction.map((pricePoint, index, array) => {
      const pricePointGrowth = parseFloat(pricePoint.growthSinceFirstEpoch);
      const growthSinceFirstEpoch = toTwoDecimalPlaces(
        pricePointGrowth - publicLaunchOffset
      );
      const ethPrice = toTwoDecimalPlaces(
        (ethPrices[index] / ethPrices[0] - 1) * 100
      );

      if (pricePoint.predictedGrowthSinceFirstEpoch) {
        const predictedPricePointGrowth = parseFloat(
          pricePoint.predictedGrowthSinceFirstEpoch
        );

        return {
          ...pricePoint,
          ethPrice: NaN,
          predictedEthPrice: ethPrice,
          growthSinceFirstEpoch: NaN,
          predictedGrowthSinceFirstEpoch: toTwoDecimalPlaces(
            predictedPricePointGrowth - publicLaunchOffset
          ),
        };
      }

      if (index === array.length - 2) {
        return {
          ...pricePoint,
          ethPrice,
          predictedEthPrice: ethPrice,
          growthSinceFirstEpoch,
          predictedGrowthSinceFirstEpoch: growthSinceFirstEpoch,
        };
      }

      return {
        ...pricePoint,
        ethPrice,
        predictedEthPrice: null,
        growthSinceFirstEpoch,
        predictedGrowthSinceFirstEpoch: null,
      };
    });
  }
};
