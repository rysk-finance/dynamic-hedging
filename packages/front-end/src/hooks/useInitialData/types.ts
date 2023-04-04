import { BigNumberish } from "ethers";

interface Expiry {
  timestamp: string;
}

export interface PositionOToken {
  createdAt: string;
  expiryTimestamp: string;
  id: HexString;
  isPut: boolean;
  strikePrice: BigNumberish;
  symbol: string;
}

export interface OptionsTransaction {
  fee: string;
  premium: string;
}

interface Position {
  netAmount: string;
  oToken: PositionOToken;
  optionsBoughtTransactions: OptionsTransaction[];
  optionsSoldTransactions: OptionsTransaction[];
}

export interface Vault {
  shortOToken: {
    id: HexString;
  };
  vaultId: string;
}

export interface InitialDataQuery {
  expiries: Expiry[];
  positions: Position[];
  vaults: Vault[];
}
