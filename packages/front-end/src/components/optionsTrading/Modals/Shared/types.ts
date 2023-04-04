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

export interface AddressesRequiredVaultSell extends Addresses {
  token: HexString;
  user: HexString;
  vaultId: BigNumber;
  collateralAsset: HexString;
}

export interface VaultQueryData {
  vault: { id: string; collateralAmount: string; shortAmount: string };
}
