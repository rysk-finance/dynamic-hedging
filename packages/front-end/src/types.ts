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
  LOCALHOST = "localhost",
  ARBITRUM_RINKEBY = "arbitrumRinkeby",
  MAINNET = "mainnet",
  ARBITRUM_MAINNET = "arbitrum",
}

export type RyskContractAddresses = {
  OpynController: string;
  OpynAddressBook: string;
  OpynOracle: string;
  OpynNewCalculator: string;
  OpynOptionRegistry: string;
  priceFeed: string;
  volFeed: string;
  optionProtocol: string;
  liquidityPool: string;
  authority: string;
  portfolioValuesFeed: string;
  optionHandler: string;
  opynInteractions: string;
  normDist: string;
  BlackScholes: string;
  optionsCompute: string;
};

export type ExternalContractAddresses = {
  USDC: string;
  WETH: string;
};

export type ContractAddresses = RyskContractAddresses &
  ExternalContractAddresses;

export type OptionSeries = {
  expiration: TimestampSeconds;
  strike: BigNumber;
  isPut: boolean;
  underlying: Address;
  strikeAsset: Address;
  collateral: Address;
};

export type Order = {
  optionSeries: OptionSeries;
  amount: BigNumber;
  price: BigNumber;
  orderExpiry: BigNumber;
  buyer: Address;
  seriesAddress: Address;
};

export type Events = {
  Approval: { owner: Address; spender: Address; value: BigNumber };
};

export enum Currency {
  USDC = "USDC",
  RYSK = "RYSK",
  OPYN = "OPYN",
}
