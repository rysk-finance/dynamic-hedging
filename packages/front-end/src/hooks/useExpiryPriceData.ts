import { gql, useQuery } from "@apollo/client";
import { useState } from "react"

export function useExpiryPriceData() {

  const [allOracleAssets, setAllOracleAssets] = useState<any[] | null>(null); 

  const getOracleAssetsAndPricers = (data: any) => {
    setAllOracleAssets(data.oracleAssets)
  };

  useQuery(
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
        prices (first: 1000) {
          id
          expiry
          reportedTimestamp
          isDisputed
          price
        }
      } 
    },
  `,
    {
      onCompleted: getOracleAssetsAndPricers,
      onError: (err) => {
        console.log(err);
      },
      context: { clientName: 'opyn' }
    },
  );

  return { allOracleAssets }
}
