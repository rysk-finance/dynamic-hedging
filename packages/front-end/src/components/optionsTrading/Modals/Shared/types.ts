import type { BigNumber } from "ethers";

export interface Addresses {
  exchange: HexString;
  collateral?: HexString;
  token?: HexString;
  user?: HexString;
  vaultID?: string;
}

export interface AllowanceState {
  approved: boolean;
  amount: BigNumber;
}
