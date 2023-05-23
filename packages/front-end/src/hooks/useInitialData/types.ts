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
  vault?: Vault;
}

export interface Vault {
  id: string;
  shortOToken: {
    id: HexString;
  };
  vaultId: string;
  collateralAmount: string;
  shortAmount: string;
  collateralAsset: { id: string };
}

export interface InitialDataQuery {
  expiries: Expiry[];
  longPositions: Position[];
  shortPositions: Position[];
}
