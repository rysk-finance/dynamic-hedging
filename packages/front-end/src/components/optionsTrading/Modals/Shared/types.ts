import type { BigNumber } from "ethers";

export interface Addresses {
  exchange: HexString;
  collateral?: HexString;
  token?: HexString;
  user?: HexString;
  vaultID?: string;
}

export interface SpreadAddresses extends Omit<Addresses, "token"> {
  marginPool: HexString;
  token: [HexString | undefined, HexString | undefined];
}

export interface AllowanceState {
  approved: boolean;
  amount: BigNumber;
}

export type CloseLongOperation = "close" | "sell";
