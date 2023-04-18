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
          skip: 2
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

      const publicLaunchOffset = pricePerShares.length
        ? parseFloat(pricePerShares[0].growthSinceFirstEpoch)
        : 0;

      const adjustedChartData = pricePerShares.map((pricePoint) => {
        const pricePointGrowth = parseFloat(pricePoint.growthSinceFirstEpoch);
        const growthSinceFirstEpoch = toTwoDecimalPlaces(
          pricePointGrowth - publicLaunchOffset
        );

        return {
          ...pricePoint,
          growthSinceFirstEpoch,
        };
      });

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
          <Stats
            cumulativeYield={
              chartData[chartData.length - 1]?.growthSinceFirstEpoch
            }
          />
          <Chart chartData={chartData} />
          <Disclaimer />
        </FadeWrapper>
      )}
    </AnimatePresence>
  );
};
