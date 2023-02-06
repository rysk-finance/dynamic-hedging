export interface InitiateWithdrawAction {
  id: string;
  address: string;
  amount: string;
  epoch: string;
  timestamp: string;
}

export interface PricePerShare {
  id: string;
  epoch: string;
  value: string;
  growthSinceFirstEpoch: string;
  timestamp: string;
  __typename: string;
}

export interface DepositAction {
  id: string;
  amount: string;
  epoch: string;
  timestamp: string;
}

export interface QueryData {
  pricePerShares: PricePerShare[];
  initiateWithdrawActions: InitiateWithdrawAction[];
  depositActions: DepositAction[];
}

export interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: string; length: number }>;
  label?: string;
}

export interface PNL {
  epoch: string;
  pnl: string;
  change: string;
  shares: string;
  timestamp: string;
  dateLocale: string;
}
