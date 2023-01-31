import type { OracleAsset, OracleAssets } from "./types";

import { gql, useQuery } from "@apollo/client";
import { captureException } from "@sentry/react";
import { useState } from "react";

export function useExpiryPriceData() {
  const [allOracleAssets, setAllOracleAssets] = useState<OracleAsset[] | null>(
    null
  );

  const getOracleAssetsAndPricers = (data: OracleAssets) => {
    setAllOracleAssets(data.oracleAssets);
  };

  useQuery<OracleAssets>(
    gql`
      query {
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
      onError: (err) => {
        captureException(err);
        console.log(err);
      },
      context: { clientName: "opyn" },
    }
  );

  return { allOracleAssets };
}
