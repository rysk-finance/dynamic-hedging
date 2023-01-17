import type { QueryData, ChartData } from "./VaultPerformance.types";

import { gql, useQuery } from "@apollo/client";
import { captureException } from "@sentry/react";
import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";

import { toTwoDecimalPlaces } from "src/utils/rounding";

import { Chart } from "./subcomponents/Chart";
import { Disclaimer } from "./subcomponents/Disclaimer";
import { Error } from "./subcomponents/Error";
import { Loading } from "./subcomponents/Loading";
import { FadeWrapper } from "./subcomponents/FadeWrapper";
import { Stats } from "./subcomponents/Stats";

export const VaultPerformance = () => {
  const [chartData, setChartData] = useState<ChartData[]>([]);

  const { loading, error, data } = useQuery<QueryData>(
    gql`
      query {
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
      onError: (err) => {
        captureException(err);
        console.error(err);
      },
    }
  );

  useEffect(() => {
    if (data) {
      const { pricePerShares } = data;

      const publicLaunchOffset = parseFloat(
        pricePerShares[0].growthSinceFirstEpoch
      );

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
    <AnimatePresence exitBeforeEnter>
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
