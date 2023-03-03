import { BigNumber } from "ethers";
import { Dispatch } from "react";

export type AppSettings = {
  vaultDepositUnlimitedApproval: boolean;
  optionsTradingUnlimitedApproval: boolean;
};

// Global context
export type GlobalState = {
  ethPrice: number | null;
  eth24hChange: number;
  eth24hHigh: number | null;
  eth24hLow: number | null;
  ethPriceUpdateTime: Date | null;
  ethPriceError: boolean;
  userPositionValue: BigNumber | null;
  positionBreakdown: {
    redeemedShares: BigNumber | null;
    usdcOnHold: BigNumber | null;
    unredeemedShares: BigNumber | null;
    pendingWithdrawShares: {
      amount: BigNumber;
      epochPrice: BigNumber;
    } | null;
    currentWithdrawSharePrice: BigNumber | null;
  };
  connectWalletIndicatorActive: boolean;
  settings: AppSettings;
};

export enum ActionType {
  SET_ETH_PRICE,
  SET_ETH_PRICE_ERROR,
  SET_POSITION_VALUE,
  SET_POSITION_BREAKDOWN,
  SET_CONNECT_WALLET_INDICATOR_IS_ACTIVE,
  SET_SETTINGS,
  RESET_GLOBAL_STATE,
}

export type GlobalAction =
  | {
      type: ActionType.SET_ETH_PRICE;
      price: number;
      change?: number;
      date: Date;
      high?: number;
      low?: number;
      error: boolean;
    }
  | {
      type: ActionType.SET_ETH_PRICE_ERROR;
      error: boolean;
    }
  | {
      type: ActionType.SET_POSITION_VALUE;
      value: BigNumber;
    }
  | {
      type: ActionType.SET_POSITION_BREAKDOWN;
      values: Partial<GlobalState["positionBreakdown"]>;
    }
  | {
      type: ActionType.SET_CONNECT_WALLET_INDICATOR_IS_ACTIVE;
      isActive: boolean;
    }
  | {
      type: ActionType.SET_SETTINGS;
      settings: Partial<AppSettings>;
    }
  | {
      type: ActionType.RESET_GLOBAL_STATE;
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
  withdrawPricePerShare: BigNumber | null;
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
  expiryDate: number | null;
  optionParams: OptionParams | null;
  customOptionStrikes: number[];
  selectedOption: SelectedOption | null;
  visibleStrikeRange: StrikeRangeTuple;
  visibleColumns: Set<ColumNames>;
};

export type StrikeRangeTuple = [string, string];

export type ColumNames = "bid" | "ask" | "bid iv" | "ask iv" | "delta" | "pos";

export type OptionsTradingContext = {
  state: OptionsTradingState;
  dispatch: Dispatch<OptionsTradingAction>;
};

export enum OptionType {
  CALL = "CALL",
  PUT = "PUT",
}

export interface SelectedOption {
  bidOrAsk: "bid" | "ask";
  callOrPut: "call" | "put";
  strikeOptions: StrikeOptions;
}

export interface StrikeOptions {
  strike: number;
  call: {
    bid: {
      IV: number;
      quote: number;
      disabled: boolean;
    };
    ask: {
      IV: number;
      quote: number;
      disabled: boolean;
    };
    delta: number;
    pos: number;
  };
  put: {
    bid: {
      IV: number;
      quote: number;
      disabled: boolean;
    };
    ask: {
      IV: number;
      quote: number;
      disabled: boolean;
    };
    delta: number;
    pos: number;
  };
}

export type OptionParams = {
  minCallStrikePrice: BigNumber;
  maxCallStrikePrice: BigNumber;
  minPutStrikePrice: BigNumber;
  maxPutStrikePrice: BigNumber;
  minExpiry: BigNumber;
  maxExpiry: BigNumber;
};

export interface OptionSeries {
  expiration: BigNumber;
  strike: BigNumber;
  strikeAsset: HexString;
  underlying: HexString;
  collateral: HexString;
  isPut: boolean;
}

export enum OptionsTradingActionType {
  SET_OPTION_TYPE,
  SET_EXPIRY_DATE,
  SET_SELECTED_OPTION,
  ADD_CUSTOM_STRIKE,
  SET_OPTION_PARAMS,
  SET_VISIBLE_STRIKE_RANGE,
  RESET_VISIBLE_STRIKE_RANGE,
  SET_VISIBLE_COLUMNS,
  RESET_VISIBLE_COLUMNS,
}

export type OptionsTradingAction =
  | {
      type: OptionsTradingActionType.SET_OPTION_TYPE;
      optionType: OptionType;
    }
  | {
      type: OptionsTradingActionType.SET_EXPIRY_DATE;
      date: number | null;
    }
  | {
      type: OptionsTradingActionType.ADD_CUSTOM_STRIKE;
      strike: number;
    }
  | {
      type: OptionsTradingActionType.SET_SELECTED_OPTION;
      option: SelectedOption | null;
    }
  | {
      type: OptionsTradingActionType.SET_OPTION_PARAMS;
      params: OptionParams | null;
    }
  | {
      type: OptionsTradingActionType.SET_VISIBLE_STRIKE_RANGE;
      visibleStrikeRange: StrikeRangeTuple;
    }
  | {
      type: OptionsTradingActionType.RESET_VISIBLE_STRIKE_RANGE;
    }
  | {
      type: OptionsTradingActionType.SET_VISIBLE_COLUMNS;
      column: ColumNames;
    }
  | {
      type: OptionsTradingActionType.RESET_VISIBLE_COLUMNS;
    };
