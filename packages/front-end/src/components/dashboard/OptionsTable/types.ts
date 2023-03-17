import type { BigNumberish } from "ethers";
import type { ReactNode } from "react";

type CompleteRedeem = (otokenId: string, amount: number) => Promise<void>;

interface Balance {
  __typename: string;
  balance: string;
  token: {
    __typename: string;
    id: string;
  };
}

interface writeOptionsTransaction {
  premium: BigNumberish;
}

interface Position {
  __typename: string;
  id: string;
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
  writeOptionsTransactions: writeOptionsTransaction[];
  account: {
    __typename: string;
    balances: Balance[];
  };
}

interface ParsedPosition {
  amount: number;
  createdAt: string;
  entryPrice: string;
  expired: boolean;
  expiryPrice?: string;
  expiryTimestamp: string;
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
}

interface TableProps {
  positions: ParsedPosition[];
  completeRedeem: CompleteRedeem;
}

export {
  type CompleteRedeem,
  type Position,
  type ParsedPosition,
  type TableProps,
};
