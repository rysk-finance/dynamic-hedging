// TODO(HC): Move this into env variable
export const CMC_API_KEY = "f9cc515d-6b5f-4f39-8d29-dd60f148c713";

export const endpoints = {
  // TODO(HC): Move this API key into .env
  ethPrice:
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=ethereum",
};

const deployment = process.env.REACT_APP_SUBGRAPH_URL
  ? `?deployment=${process.env.REACT_APP_SUBGRAPH_URL.split("name/")[1]}`
  : "";
export const SUBGRAPH_STATUS = `https://www.rysk.finance/api/subgraph-status/${deployment}`;
