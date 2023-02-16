export type ExpiryDateList = number[];
export type VisibleRange = [number, number];

export interface UserPositions {
  account: {
    __typename: string;
    balances: {
      balance: string;
      token: {
        expiryTimestamp: string;
        __typename: string;
      };
      __typename: string;
    }[];
  };
}

export interface UserExpiryStatus {
  isLong: boolean;
  isShort: boolean;
  timestamp: number;
}

export type UserExpiryStatusNoTimestamp = Omit<UserExpiryStatus, "timestamp">;

export interface DateListProps {
  expiryDates: ExpiryDateList;
  visibleRange: VisibleRange;
  expiryDate: number | null;
  handleExpirySelection: (date: number) => VoidFunction;
  balances?: UserExpiryStatus[];
}
