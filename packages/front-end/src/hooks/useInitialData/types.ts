import type { BigNumberish } from "ethers";

import type { CollateralType } from "src/state/types";

export interface LongPositionOToken {
  createdAt: string;
  expiryTimestamp: string;
  id: HexString;
  isPut: boolean;
  strikePrice: BigNumberish;
  symbol: string;
}

export interface ShortPositionOToken extends LongPositionOToken {
  collateralAsset: {
    symbol: CollateralType;
  };
}

export interface OptionsTransaction {
  fee: string;
  premium: string;
}

export interface Vault {
  id: string;
  vaultId: string;
  collateralAmount: string;
  shortAmount: string;
  collateralAsset: { id: string };
}

export interface LongPosition {
  active: boolean;
  netAmount: string;
  realizedPnl: BigNumberish;
  oToken: LongPositionOToken;
  optionsBoughtTransactions: OptionsTransaction[];
  optionsSoldTransactions: OptionsTransaction[];
  vault?: Vault;
}

export interface ShortPosition extends LongPosition {
  liquidateActions: {
    collateralPayout: BigNumberish;
  }[];
}

export interface OraclePrices {
  prices: {
    expiry: string;
    price: BigNumberish;
  }[];
}

export interface InitialDataQuery {
  longPositions: LongPosition[];
  shortPositions: ShortPosition[];
  oracleAsset: OraclePrices;
}
