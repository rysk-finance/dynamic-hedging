import type { BigNumber } from "ethers";

export interface Addresses {
  exchange: HexString;
  collateral?: HexString;
  token?: HexString;
  user?: HexString;
  vaultID?: string;
}

export interface AddressesRequired extends Addresses {
  token: HexString;
  user: HexString;
}

export interface AllowanceState {
  approved: boolean;
  amount: BigNumber;
}

export interface AddressesRequiredVaultSell extends Addresses {
  token: HexString;
  user: HexString;
  collateral: HexString;
}

export interface VaultQueryData {
  vault: {
    id: string;
    collateralAmount: string;
    shortAmount: string;
    collateralAsset: { id: string };
  };
}
