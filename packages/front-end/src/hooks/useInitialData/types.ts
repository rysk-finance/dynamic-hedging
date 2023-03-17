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

interface Position {
  amount: BigNumberish;
  oToken: PositionOToken;
  optionsBoughtTransactions: {
    amount: BigNumberish;
    fee: string;
    premium: string;
  }[];
}

export interface InitialDataQuery {
  expiries: Expiry[];
  positions: Position[];
}
