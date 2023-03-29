import type { BigNumber } from "ethers";

export interface Addresses {
  exchange: HexString;
  token?: HexString;
  user?: HexString;
}

export interface AddressesRequired extends Addresses {
  token: HexString;
  user: HexString;
}

export interface AllowanceState {
  approved: boolean;
  amount: BigNumber;
}
