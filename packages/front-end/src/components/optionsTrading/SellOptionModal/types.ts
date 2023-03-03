import type { BigNumber } from "ethers";

export interface AllowanceState {
  approved: boolean;
  amount: BigNumber;
}

export interface PositionDataState {
  created: string | null;
  now: string | null;
  totalSize: number;
  totalValue: number;
  totalPaid: number;
  inProfit: boolean;
  title: string | null;
}

export interface Addresses {
  exchange: HexString;
  token?: HexString;
  user?: HexString;
}

export interface AddressesRequired extends Addresses {
  token: HexString;
  user: HexString;
}

export interface PricingProps {
  positionData: PositionDataState;
}