import { BigNumberish } from "ethers";

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
  active: boolean;
  netAmount: string;
  oToken: PositionOToken;
  optionsBoughtTransactions: OptionsTransaction[];
  optionsSoldTransactions: OptionsTransaction[];
  vault?: Vault;
}

export interface Vault {
  id: string;
  vaultId: string;
  collateralAmount: string;
  shortAmount: string;
  collateralAsset: { id: string };
}

export interface OraclePrices {
  prices: {
    expiry: string;
    price: BigNumberish;
  }[];
}

export interface InitialDataQuery {
  longPositions: Position[];
  shortPositions: Position[];
  oracleAsset: OraclePrices;
}
