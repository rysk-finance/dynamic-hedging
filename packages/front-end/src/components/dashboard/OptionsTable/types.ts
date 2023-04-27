import type { BigNumberish } from "ethers";
import type { ReactNode } from "react";
import { FullPosition } from "src/state/types";

type CompleteRedeem = (otokenId: string, amount: number) => Promise<void>;
type CompleteSettle = (vaultId: string) => Promise<void>;
type AdjustCollateral = (position: FullPosition) => void;

interface Balance {
  __typename: string;
  balance: string;
  token: {
    __typename: string;
    id: string;
  };
}

interface optionsSoldTransaction {
  amount: BigNumberish;
  premium: BigNumberish;
}

interface optionsBoughtTransaction {
  amount: BigNumberish;
  premium: BigNumberish;
}

interface LongPosition {
  __typename: string;
  id: string;
  netAmount: BigNumberish;
  active: boolean;
  buyAmount: BigNumberish;
  sellAmount: BigNumberish;
  realizedPnl: BigNumberish;
  redeemActions: {
    id: string;
  }[];
  oToken: {
    __typename: string;
    id: string;
    symbol: string;
    expiryTimestamp: string;
    strikePrice: string;
    isPut: boolean;
    underlyingAsset: {
      __typename: string;
      id: string;
    };
    createdAt: string;
  };
  optionsSoldTransactions: optionsSoldTransaction[];
  optionsBoughtTransactions: optionsBoughtTransaction[];
}

interface ShortPosition {
  __typename: string;
  id: string;
  netAmount: BigNumberish;
  buyAmount: BigNumberish;
  sellAmount: BigNumberish;
  realizedPnl: BigNumberish;
  active: boolean;
  vault: {
    id: string;
    vaultId: string;
    collateralAmount: string;
    collateralAsset: {
      name: string;
    };
  };
  settleActions: {
    id: string;
  }[];
  oToken: {
    __typename: string;
    id: string;
    symbol: string;
    expiryTimestamp: string;
    strikePrice: string;
    isPut: boolean;
    underlyingAsset: {
      __typename: string;
      id: string;
    };
    createdAt: string;
  };
  optionsSoldTransactions: optionsSoldTransaction[];
  optionsBoughtTransactions: optionsBoughtTransaction[];
}

interface ParsedPosition {
  amount: number;
  createdAt: string;
  entryPrice: string;
  expired: boolean;
  expiryPrice?: string;
  liquidationPrice: number;
  id: string;
  isPut: boolean;
  isRedeemable: boolean;
  otokenId: string;
  side: string;
  status: string | ReactNode;
  strikePrice: string;
  symbol: string;
  totalPremium: number;
  underlyingAsset: string;
  isSettleable: boolean;
  vaultId: string;
  collateralAsset: string;
  collateralAmount: string;
  expiryTimestamp: string;
  pnl: number;
}

interface TableProps {
  positions: ParsedPosition[];
  completeRedeem: CompleteRedeem;
  completeSettle: CompleteSettle;
  adjustCollateral: AdjustCollateral;
  active: boolean;
}

export {
  type CompleteRedeem,
  type CompleteSettle,
  type AdjustCollateral,
  type ParsedPosition,
  type TableProps,
  type LongPosition,
  type ShortPosition,
};
