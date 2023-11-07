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
  collateralPayout: string;
}

export interface Position {
  active: boolean;
  buyAmount?: string;
  liquidateActions?: LiquidateActions[];
  netAmount: string;
  oToken: PositionOToken;
  optionsBoughtTransactions: OptionsTransaction[];
  optionsSoldTransactions: OptionsTransaction[];
  realizedPnl: string;
  fees: string;
  redeemActions?: RedeemActions[];
  sellAmount?: string;
  settleActions?: SettleActions[];
  vault?: Vault;
}

export interface LongCollateral
  extends Pick<
    Position,
    | "fees"
    | "realizedPnl"
    | "oToken"
    | "optionsBoughtTransactions"
    | "optionsSoldTransactions"
  > {
  totalPremiumBought: number;
  totalPremiumSold: number;
  vaultId: string;
}

export interface LongCollateralMap {
  [vaultID: LongCollateral["vaultId"]]: LongCollateral;
}

export interface Vault {
  id: string;
  vaultId: string;
  collateralAmount: string;
  shortAmount: string;
  collateralAsset: { id: HexString };
  longCollateral?: LongCollateral;
}

export interface OraclePrices {
  prices: {
    expiry: string;
    price: string;
  }[];
}

export interface InitialDataQuery {
  longCollateral: LongCollateral[];
  longPositions: Position[];
  shortPositions: Position[];
  oracleAsset: OraclePrices;
}
