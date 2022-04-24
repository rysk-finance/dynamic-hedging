import { Dispatch } from "react";

// Global context
export type GlobalState = {
  ethPrice: number | null;
  eth24hChange: number | null;
};

export enum ActionType {
  SET_ETH_PRICE,
}

export type GlobalAction = {
  type: ActionType.SET_ETH_PRICE;
  price: number;
  change?: number;
};

export type GlobalContext = {
  state: GlobalState;
  dispatch: Dispatch<GlobalAction>;
};

// Options trading context
export type OptionsTradingState = {
  optionType: OptionType;
  expiryDate: Date | null;
};

export type OptionsTradingContext = {
  state: OptionsTradingState;
  dispatch: Dispatch<OptionsTradingAction>;
};

export enum OptionType {
  CALL,
  PUT,
}

export enum OptionsTradingActionType {
  SET_OPTION_TYPE,
  SET_EXPIRY_DATE,
}

export type OptionsTradingAction =
  | {
      type: OptionsTradingActionType.SET_OPTION_TYPE;
      optionType: OptionType;
    }
  | {
      type: OptionsTradingActionType.SET_EXPIRY_DATE;
      date: Date;
    };
