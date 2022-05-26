import { BigNumber } from "ethers";

export type Option<T> = {
  label: string;
  value: T;
  key: string;
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
