// TODO(HC): Move this into env variable
export const CMC_API_KEY = "f9cc515d-6b5f-4f39-8d29-dd60f148c713";

export const endpoints = {
  // TODO(HC): Move this API key into .env
  ethPrice:
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=ethereum",
};

const deployment = process.env.REACT_APP_SUBGRAPH_URL
  ? `?deployment=arbitrum${
      process.env.REACT_APP_SUBGRAPH_URL.split("arbitrum")[1].split("/gn")[0]
    }`
  : "";
export const SUBGRAPH_STATUS = `https://api.rysk.finance/subgraph-status${deployment}`;
