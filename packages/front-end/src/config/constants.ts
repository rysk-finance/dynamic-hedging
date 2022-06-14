import { BigNumber } from "ethers";

export const MAX_UINT_256 =
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

export const ZERO_UINT_256 = "0x00";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const DECIMALS = {
  USDC: 6,
  RYSK: 18,
};

// Using strings in constructor to avoid JS max int issues.
export const BIG_NUMBER_DECIMALS = {
  USDC: BigNumber.from("1000000"),
  RYSK: BigNumber.from("1000000000000000000"),
};

export enum CHAINID {
  ETH_MAINNET = 1,
  ARBITRUM_RINKEBY = 421611,
}

export const WETH_ADDRESS = {
  [CHAINID.ETH_MAINNET]: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  [CHAINID.ARBITRUM_RINKEBY]: "0xe32513090f05ed2ee5f3c5819c9cce6d020fefe7",
};

export const USDC_ADDRESS = {
  [CHAINID.ETH_MAINNET]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  [CHAINID.ARBITRUM_RINKEBY]: "0x3c6c9b6b41b9e0d82fed45d9502edffd5ed3d737",
};

export const OPYN_OPTION_REGISTRY = {
  [CHAINID.ETH_MAINNET]: "",
  [CHAINID.ARBITRUM_RINKEBY]: "0xA6005cAcF024404d4335751d4dE8c23ff6EC5214",
};

export const LIQUIDITY_POOL = {
  [CHAINID.ETH_MAINNET]: "",
  [CHAINID.ARBITRUM_RINKEBY]: "0xA7f49544f51f46E3bA2099A3aCad70502b8bc125",
};

export const PRICE_FEED = {
  [CHAINID.ETH_MAINNET]: "",
  [CHAINID.ARBITRUM_RINKEBY]: "0xDbBF84a29515C783Ea183f92120be7Aa9120fA23",
};
