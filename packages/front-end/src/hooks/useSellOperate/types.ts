import { Address } from "../../types";

export interface QueryData {
  account: {
    id: Address;
    vaultCount: string;
  };
  vaults: Array<{
    vaultId: string;
    shortOToken: {
      id: string;
    };
  }>;
}
