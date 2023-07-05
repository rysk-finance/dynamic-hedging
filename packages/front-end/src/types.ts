import { BigNumber } from "ethers";

export type Address = string;
// UNIX time in seconds (note this differs from JS which uses ms)
export type TimestampSeconds = string;

export type Option<T> = {
  label: string;
  value: T;
  key: string;
  disabled?: boolean;
  disabledTooltip?: string;
};

export type DepositReceipt = {
  amount: BigNumber;
  epoch: BigNumber;
  unredeemedShares: BigNumber;
};

export type WithdrawalReceipt = {
  shares: BigNumber;
  epoch: BigNumber;
};

export enum ETHNetwork {
  ARBITRUM_GOERLI = "arbitrum-goerli",
  ARBITRUM_MAINNET = "arbitrum",
}

export type RyskContractAddresses = {
  OpynController: string;
  OpynOracle: string;
  OpynNewCalculator: string;
  OpynOptionRegistry: string;
  priceFeed: string;
  liquidityPool: string;
  portfolioValuesFeed: string;
  optionHandler: string;
  optionExchange: string;
  beyondPricer: string;
};

export type ExternalContractAddresses = {
  USDC: string;
  WETH: string;
};

export type RyskLensAddresses = {
  DHVLens: string;
  UserPositionLens: string;
};

export type ContractAddresses = RyskContractAddresses &
  ExternalContractAddresses &
  RyskLensAddresses;

export type OptionSeries = {
  expiration: BigNumber;
  strike: BigNumber;
  isPut: boolean;
  underlying: HexString;
  strikeAsset: HexString;
  collateral: HexString;
};

export type Order = {
  optionSeries: OptionSeries;
  amount: BigNumber;
  price: BigNumber;
  orderExpiry: BigNumber;
  buyer: Address;
  seriesAddress: Address;
  isBuyBack: boolean;
};

export type StrangleOrder = {
  call: Order;
  put: Order;
};

export type Events = {
  Approval: { owner: Address; spender: Address; value: BigNumber };
};

export enum Currency {
  USDC = "USDC",
  RYSK = "RYSK",
  OPYN = "OPYN",
}
