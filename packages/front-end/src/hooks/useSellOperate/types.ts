import { Address } from "../../types";

export interface QueryData {
  account: {
    id: Address;
    vaultCount: string;
  };
}
