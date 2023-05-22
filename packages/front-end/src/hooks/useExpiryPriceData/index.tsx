import type { OracleAsset, OracleAssets } from "./types";

import { gql, useQuery } from "@apollo/client";
import { useState } from "react";

import { QueriesEnum } from "src/clients/Apollo/Queries";
import { logError } from "src/utils/logError";

export function useExpiryPriceData() {
  const [allOracleAssets, setAllOracleAssets] = useState<OracleAsset[] | null>(
    null
  );

  const getOracleAssetsAndPricers = (data: OracleAssets) => {
    setAllOracleAssets(data.oracleAssets);
  };

  useQuery<OracleAssets>(
    gql`
      query ${QueriesEnum.ORACLE_ASSETS} {
        oracleAssets {
          asset {
            id
            symbol
            decimals
          }
          pricer {
            id
            lockingPeriod
            disputePeriod
          }
          prices(first: 1000) {
            id
            expiry
            reportedTimestamp
            isDisputed
            price
          }
        }
      }
    `,
    {
      onCompleted: getOracleAssetsAndPricers,
      onError: logError,
    }
  );

  return { allOracleAssets };
}
