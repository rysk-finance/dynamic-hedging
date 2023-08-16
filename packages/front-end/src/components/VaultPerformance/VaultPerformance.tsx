import type { ChartData, QueryData } from "./VaultPerformance.types";

import { gql, useQuery } from "@apollo/client";
import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

import { toTwoDecimalPlaces } from "src/utils/rounding";

import { QueriesEnum } from "src/clients/Apollo/Queries";
import { logError } from "src/utils/logError";
import { Chart } from "./subcomponents/Chart";
import { Disclaimer } from "./subcomponents/Disclaimer";
import { Error } from "./subcomponents/Error";
import { FadeWrapper } from "./subcomponents/FadeWrapper";
import { Loading } from "./subcomponents/Loading";
import { Stats } from "./subcomponents/Stats";

export const VaultPerformance = () => {
  const [chartData, setChartData] = useState<ChartData[]>([]);

  const { loading, error, data } = useQuery<QueryData>(
    gql`
      query ${QueriesEnum.VAULT_PERFORMANCE} {
        pricePerShares(
          orderBy: "epoch"
          orderDirection: "asc"
          first: 1000
          skip: 3
        ) {
          epoch
          growthSinceFirstEpoch
          timestamp
        }
      }
    `,
    {
      onError: logError,
    }
  );

  useEffect(() => {
    if (data) {
      const { pricePerShares } = data;
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

      const adjustedChartData = pricePerSharesWithPrediction.map(
        (pricePoint, index, array) => {
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
        }
      );

      setChartData(adjustedChartData);
    }
  }, [data]);

  return (
    <AnimatePresence mode="wait">
      {loading && (
        <FadeWrapper key="loading">
          <Loading />
        </FadeWrapper>
      )}

      {error && (
        <FadeWrapper key="error">
          <Error />
        </FadeWrapper>
      )}

      {data && (
        <FadeWrapper key="data">
          <section className="flex flex-col w-1/4 xl:1/3">
            <Stats chartData={chartData} />
            <Disclaimer />
          </section>

          <section className="w-3/4 xl:2/3">
            <Chart chartData={chartData} />
          </section>
        </FadeWrapper>
      )}
    </AnimatePresence>
  );
};
