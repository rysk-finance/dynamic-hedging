import { BigNumber } from "ethers";

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
};

export type ContractAddresses = RyskContractAddresses &
  ExternalContractAddresses;
