import type { BigNumberish } from "ethers";

import type { CollateralType } from "src/state/types";

export interface PositionOToken {
  collateralAsset?: {
    symbol: CollateralType;
  };
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

export interface LiquidateActions {
  collateralPayout: BigNumberish;
}
export interface Vault {
  id: string;
  vaultId: string;
  collateralAmount: string;
  shortAmount: string;
  collateralAsset: { id: HexString };
}

export interface Position {
  active: boolean;
  netAmount: string;
  realizedPnl: BigNumberish;
  oToken: PositionOToken;
  optionsBoughtTransactions: OptionsTransaction[];
  optionsSoldTransactions: OptionsTransaction[];
  liquidateActions?: LiquidateActions[];
  vault?: Vault;
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
