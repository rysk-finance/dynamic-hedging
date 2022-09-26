import { BigNumber } from "ethers";
import { Currency as Token, ETHNetwork } from "../types";

export const EXPLORER_URL =
  process.env.REACT_APP_ENV === "production"
    ? "https://arbiscan.io/"
    : "https://testnet.arbiscan.io/";

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
  ETH_MAINNET = 1,
  ARBITRUM_MAINNET = 42161,
  ARBITRUM_RINKEBY = 421611,
  LOCALHOST = 1337,
}

export const IDToNetwork: Record<CHAINID, ETHNetwork> = {
  [CHAINID.ETH_MAINNET]: ETHNetwork.MAINNET,
  [CHAINID.ARBITRUM_MAINNET]: ETHNetwork.ARBITRUM_MAINNET,
  [CHAINID.ARBITRUM_RINKEBY]: ETHNetwork.ARBITRUM_RINKEBY,
  [CHAINID.LOCALHOST]: ETHNetwork.LOCALHOST,
};

export const RPC_URL_MAP: Record<CHAINID, string> = {
  [CHAINID.ETH_MAINNET]: `https://mainnet.infura.io/v3/${process.env.REACT_APP_INFURA_KEY}`,
  [CHAINID.ARBITRUM_MAINNET]: `https://arbitrum-mainnet.infura.io/v3/${process.env.REACT_APP_INFURA_KEY}`,
  [CHAINID.ARBITRUM_RINKEBY]: `https://arbitrum-rinkeby.infura.io/v3/${process.env.REACT_APP_INFURA_KEY}`,
  [CHAINID.LOCALHOST]: "",
};

export const SUBGRAPH_URL = {
  [CHAINID.LOCALHOST]: "",
  [CHAINID.ETH_MAINNET]: "",
  [CHAINID.ARBITRUM_RINKEBY]:
    "https://api.thegraph.com/subgraphs/name/ugolino/rysktestnet",
  [CHAINID.ARBITRUM_MAINNET]:
    "https://api.thegraph.com/subgraphs/name/rysk-finance/rysk",
};

export const OPYN_SUBGRAPH_URL = {
  [CHAINID.LOCALHOST]: "",
  [CHAINID.ETH_MAINNET]: "",
  [CHAINID.ARBITRUM_RINKEBY]:
    "https://api.thegraph.com/subgraphs/name/ugolino/ryskopyntestnet",
  [CHAINID.ARBITRUM_MAINNET]:
    "https://api.thegraph.com/subgraphs/name/rysk-finance/rysk-opyn-gamma-arbitrum",
};

export const SCAN_URL = {
  [CHAINID.LOCALHOST]: "",
  [CHAINID.ETH_MAINNET]: "",
  [CHAINID.ARBITRUM_RINKEBY]: "https://testnet.arbiscan.io",
  [CHAINID.ARBITRUM_MAINNET]: "https://arbiscan.io",
};

export const ORACLE_DISPUTE_PERIOD = 7200;
export const ORACLE_LOCKING_PERIOD = 300;


export const DHV_NAME = "Rysk DHV ETH/USDC";