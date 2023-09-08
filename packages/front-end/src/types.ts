import { BigNumber } from "ethers";

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

type RyskContractAddresses = {
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
  marginPool: string;
};

type ExternalContractAddresses = {
  USDC: string;
  WETH: string;
  ETHUSDAggregator: string;
};

type RyskLensAddresses = {
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
  buyer: string;
  seriesAddress: string;
  isBuyBack: boolean;
};

export type StrangleOrder = {
  call: Order;
  put: Order;
};

export enum Currency {
  USDC = "USDC",
  RYSK = "RYSK",
  OPYN = "OPYN",
}
