import { BigNumber } from "ethers";
import { Currency as Token, ETHNetwork } from "../types";

export const EXPLORER_URL =
  process.env.REACT_APP_ENV === "production"
    ? "https://arbiscan.io/"
    : "https://goerli.arbiscan.io/";

export const MAX_UINT_256 =
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

export const ZERO_UINT_256 = "0x00";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const DECIMALS: Record<Token, number> = {
  USDC: 6,
  OPYN: 8,
  RYSK: 18,
};

// Using strings in constructor to avoid JS max int issues.
export const BIG_NUMBER_DECIMALS: Record<Token, BigNumber> = {
  USDC: BigNumber.from("1000000"),
  OPYN: BigNumber.from("100000000"),
  RYSK: BigNumber.from("1000000000000000000"),
};
// Ethers event polling interval
export const DEFAULT_POLLING_INTERVAL = 20000;

// Proportion added to approval transaction to account for price moving.
const APPROVAL_MARGIN = 0.1;

// Storing as percent to avoid BigNumber issues.
export const GAS_LIMIT_MULTIPLIER_PERCENTAGE = BigNumber.from(120);

export enum CHAINID {
  ARBITRUM_MAINNET = 42161,
  LOCALHOST = 1337,
  ARBITRUM_GOERLI = 421613,
}

export const IDToNetwork: Record<CHAINID, ETHNetwork> = {
  [CHAINID.ARBITRUM_MAINNET]: ETHNetwork.ARBITRUM_MAINNET,
  [CHAINID.ARBITRUM_GOERLI]: ETHNetwork.ARBITRUM_GOERLI,
  [CHAINID.LOCALHOST]: ETHNetwork.LOCALHOST,
};

export const RPC_URL_MAP: Record<CHAINID, string> = {
  [CHAINID.ARBITRUM_MAINNET]: `https://arbitrum-mainnet.infura.io/v3/${process.env.REACT_APP_INFURA_KEY}`,
  [CHAINID.ARBITRUM_GOERLI]: `https://arbitrum-goerli.infura.io/v3/${process.env.REACT_APP_INFURA_KEY}`,
  [CHAINID.LOCALHOST]: "",
};

export const SUBGRAPH_URL = {
  [CHAINID.LOCALHOST]: "",
  [CHAINID.ARBITRUM_GOERLI]:
    "https://api.thegraph.com/subgraphs/name/devey/rysk-goerli-yassine",
  [CHAINID.ARBITRUM_MAINNET]:
    "https://api.thegraph.com/subgraphs/name/rysk-finance/rysk",
};

export const OPYN_SUBGRAPH_URL = {
  [CHAINID.LOCALHOST]: "",
  [CHAINID.ARBITRUM_MAINNET]:
    "https://api.thegraph.com/subgraphs/name/rysk-finance/rysk-opyn-gamma-arbitrum",
  [CHAINID.ARBITRUM_GOERLI]:
    "https://api.thegraph.com/subgraphs/name/devey/rysk-opyngamma-arbitrum-goerli",
};

export const SCAN_URL = {
  [CHAINID.LOCALHOST]: "",
  [CHAINID.ARBITRUM_GOERLI]: "https://goerli.arbiscan.io",
  [CHAINID.ARBITRUM_MAINNET]: "https://arbiscan.io",
};

export const ORACLE_DISPUTE_PERIOD = 7200;
export const ORACLE_LOCKING_PERIOD = 300;

export const DHV_NAME = "Rysk DHV ETH/USDC";
