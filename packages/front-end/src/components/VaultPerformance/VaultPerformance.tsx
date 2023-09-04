import type { ChartData, QueryData } from "./VaultPerformance.types";

import { gql, useQuery } from "@apollo/client";
import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

import { QueriesEnum } from "src/clients/Apollo/Queries";
import { logError } from "src/utils/logError";
import { Chart } from "./subcomponents/Chart";
import { Disclaimer } from "./subcomponents/Disclaimer";
import { Error } from "./subcomponents/Error";
import { FadeWrapper } from "./subcomponents/FadeWrapper";
import { Loading } from "./subcomponents/Loading";
import { Stats } from "./subcomponents/Stats";
import { parseData } from "./utils/parseData";

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
          ethPrice
          growthSinceFirstEpoch
          timestamp
          value
        }
      }
    `,
    {
      onError: logError,
    }
  );

  useEffect(() => {
    parseData(data).then((parsedData) => {
      if (parsedData) setChartData(parsedData);
    });

    return () => {
      setChartData([]);
    };
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
