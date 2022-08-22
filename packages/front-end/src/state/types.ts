import { BigNumber } from "ethers";
import { Dispatch } from "react";

export type AppSettings = {
  unlimitedApproval: boolean;
};

// Global context
export type GlobalState = {
  ethPrice: number | null;
  eth24hChange: number | null;
  ethPriceUpdateTime: Date | null;
  userPositionValue: BigNumber | null;
  connectWalletIndicatorActive: boolean;
  settings: AppSettings;
};

export enum ActionType {
  SET_ETH_PRICE,
  SET_POSITION_VALUE,
  SET_CONNECT_WALLET_INDICATOR_IS_ACTIVE,
  SET_SETTINGS,
}

export type GlobalAction =
  | {
      type: ActionType.SET_ETH_PRICE;
      price: number;
      change?: number;
      date: Date;
    }
  | {
      type: ActionType.SET_POSITION_VALUE;
      value: BigNumber;
    }
  | {
      type: ActionType.SET_CONNECT_WALLET_INDICATOR_IS_ACTIVE;
      isActive: boolean;
    }
  | {
      type: ActionType.SET_SETTINGS;
      settings: Partial<AppSettings>;
    };

export type GlobalContext = {
  state: GlobalState;
  dispatch: Dispatch<GlobalAction>;
};

// Vault context
export type VaultState = {
  userDHVBalance: BigNumber | null;
  depositEpoch: BigNumber | null;
  withdrawalEpoch: BigNumber | null;
  depositPricePerShare: BigNumber | null;
  withdrawalPricePerShare: BigNumber | null;
};

export enum VaultActionType {
  SET,
}

export type VaultAction = {
  type: VaultActionType.SET;
  data: Partial<VaultState>;
};

export type VaultContext = {
  state: VaultState;
  dispatch: Dispatch<VaultAction>;
};

// Options trading context
export type OptionsTradingState = {
  optionType: OptionType;
  expiryDate: Date | null;
  optionParams: OptionParams | null;
  customOptionStrikes: number[];
  selectedOption: Option | null;
};

export type OptionsTradingContext = {
  state: OptionsTradingState;
  dispatch: Dispatch<OptionsTradingAction>;
};

export enum OptionType {
  CALL = "CALL",
  PUT = "PUT",
}

export type Option = {
  type: OptionType;
  strike: number;
  IV: number;
  delta: number;
  price: number;
};

export type OptionParams = {
  minCallStrikePrice: BigNumber;
  maxCallStrikePrice: BigNumber;
  minPutStrikePrice: BigNumber;
  maxPutStrikePrice: BigNumber;
  minExpiry: BigNumber;
  maxExpiry: BigNumber;
};

export enum OptionsTradingActionType {
  SET_OPTION_TYPE,
  SET_EXPIRY_DATE,
  SET_SELECTED_OPTION,
  ADD_CUSTOM_STRIKE,
  SET_OPTION_PARAMS,
}

export type OptionsTradingAction =
  | {
      type: OptionsTradingActionType.SET_OPTION_TYPE;
      optionType: OptionType;
    }
  | {
      type: OptionsTradingActionType.SET_EXPIRY_DATE;
      date: Date | null;
    }
  | {
      type: OptionsTradingActionType.ADD_CUSTOM_STRIKE;
      strike: number;
    }
  | {
      type: OptionsTradingActionType.SET_SELECTED_OPTION;
      option: Option | null;
    }
  | {
      type: OptionsTradingActionType.SET_OPTION_PARAMS;
      params: OptionParams | null;
    };
