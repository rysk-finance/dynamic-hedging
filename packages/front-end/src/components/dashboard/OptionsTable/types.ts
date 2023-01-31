import type { BigNumber } from "ethers";

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
  premium: BigNumber;
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
  };
  writeOptionsTransactions: writeOptionsTransaction[];
  account: {
    __typename: string;
    balances: Balance[];
  };
}

interface ParsedPosition {
  status: string;
  amount: number;
  entryPrice: string;
  expired: boolean;
  expiryPrice?: string;
  expiryTimestamp: string;
  id: string;
  isPut: boolean;
  isRedeemable: boolean;
  otokenId: string;
  side: string;
  strikePrice: string;
  symbol: string;
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
