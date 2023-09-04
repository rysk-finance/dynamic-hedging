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
  strikePrice: string;
  symbol: string;
}

export interface OptionsTransaction {
  fee: string;
  premium: string;
  timestamp?: string;
}

export interface RedeemActions {
  block: string;
}

export interface SettleActions {
  block: string;
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
  buyAmount?: BigNumberish;
  liquidateActions?: LiquidateActions[];
  netAmount: BigNumberish;
  oToken: PositionOToken;
  optionsBoughtTransactions: OptionsTransaction[];
  optionsSoldTransactions: OptionsTransaction[];
  realizedPnl: BigNumberish;
  redeemActions?: RedeemActions[];
  sellAmount?: BigNumberish;
  settleActions?: SettleActions[];
  vault?: Vault;
}

export interface OraclePrices {
  prices: {
    expiry: string;
    price: string;
  }[];
}

export interface InitialDataQuery {
  longPositions: Position[];
  shortPositions: Position[];
  oracleAsset: OraclePrices;
}
