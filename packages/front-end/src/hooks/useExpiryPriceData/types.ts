interface OracleAsset {
  __typename: string;
  asset: {
    __typename: string;
    id: string;
    symbol: string;
    decimals: number;
  };
  pricer: {
    __typename: string;
    id: string;
    lockingPeriod: string;
    disputePeriod: string;
  };
  prices: {
    __typename: string;
    id: string;
    expiry: string;
    reportedTimestamp: string;
    isDisputed: boolean;
    price: string;
  }[];
}

interface OracleAssets {
  oracleAssets: OracleAsset[];
}

export { type OracleAsset, type OracleAssets };
