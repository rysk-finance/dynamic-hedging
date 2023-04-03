import type { ApolloError } from "@apollo/client";
import type { BigNumber, BigNumberish } from "ethers";

import type { PositionOToken } from "src/hooks/useInitialData/types";

import { Dispatch } from "react";

export type AppSettings = {
  vaultDepositUnlimitedApproval: boolean;
  optionsTradingUnlimitedApproval: boolean;
};

// Types related to useInitialData hook.
export type Expiries = string[];

interface UserPositionToken extends PositionOToken {
  netAmount: BigNumberish;
  totalPremium: number;
}

export interface UserPositions {
  [expiry: string]: {
    netAmount: BigNumberish;
    isLong: boolean;
    isShort: boolean;
    tokens: UserPositionToken[];
  };
}

export interface ChainData {
  [expiry: string]: {
    [strike: number]: StrikeOptions;
  };
}

export type CallSide = {
  call: StrikeSide;
};
export type PutSide = {
  put: StrikeSide;
};

export type StrikeRangeTuple = [string, string];

export type ColumNames =
  | "sell"
  | "buy"
  | "iv sell"
  | "iv buy"
  | "delta"
  | "pos"
  | "exposure";

export type CollateralType = "USDC" | "WETH";

export enum CollateralAmount {
  "1.5x" = "1.5x",
  "2x" = "2x",
  "3x" = "3x",
  "full" = "full",
}

export interface CollateralPreferences {
  type: CollateralType;
  amount: keyof typeof CollateralAmount;
}

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
  unstoppableDomain: string | null;

  // Data related to useInitialData hook.
  options: {
    activeExpiry?: string;
    data: ChainData;
    error?: ApolloError;
    expiries: Expiries;
    isOperator: boolean;
    loading: boolean;
    refresh: () => void;
    userPositions: UserPositions;
  };

  // Options chain state.
  collateralPreferences: CollateralPreferences;
  visibleStrikeRange: StrikeRangeTuple;
  visibleColumns: Set<ColumNames>;
};

export enum ActionType {
  SET_ETH_PRICE,
  SET_ETH_PRICE_ERROR,
  SET_POSITION_VALUE,
  SET_POSITION_BREAKDOWN,
  SET_CONNECT_WALLET_INDICATOR_IS_ACTIVE,
  SET_SETTINGS,
  RESET_GLOBAL_STATE,
  SET_UNSTOPPABLE_DOMAIN,
  SET_OPTIONS,
  SET_VISIBLE_STRIKE_RANGE,
  SET_VISIBLE_COLUMNS,
  SET_COLLATERAL_PREFERENCES,
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
    }
  | {
      type: ActionType.SET_UNSTOPPABLE_DOMAIN;
      unstoppableDomain: string | null;
    }
  | {
      type: ActionType.SET_OPTIONS;
      activeExpiry?: string;
      data?: ChainData;
      error?: ApolloError;
      expiries?: Expiries;
      isOperator?: boolean;
      loading?: boolean;
      refresh?: () => void;
      userPositions?: UserPositions;
    }
  | {
      type: ActionType.SET_VISIBLE_STRIKE_RANGE;
      visibleStrikeRange?: StrikeRangeTuple;
    }
  | {
      type: ActionType.SET_VISIBLE_COLUMNS;
      column?: ColumNames;
    }
  | {
      type: ActionType.SET_COLLATERAL_PREFERENCES;
      collateralPreferences?: CollateralPreferences;
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
  selectedOption?: SelectedOption;
  optionChainModalOpen?: OptionChainModal;
  tutorialIndex?: number;
};

export enum OptionChainModalActions {
  BUY = "buy",
  CLOSE = "close",
  OPERATOR = "operator",
  SELL = "sell",
}

type OptionChainModal =
  (typeof OptionChainModalActions)[keyof typeof OptionChainModalActions];

export type OptionsTradingContext = {
  state: OptionsTradingState;
  dispatch: Dispatch<OptionsTradingAction>;
};

export enum OptionType {
  CALL = "CALL",
  PUT = "PUT",
}

export type CallOrPut = "call" | "put";

export interface SelectedOption {
  buyOrSell: "sell" | "buy";
  callOrPut: CallOrPut;
  strikeOptions: StrikeOptions;
}

export interface Quote {
  fee: number;
  quote: number;
  total: number;
}

export interface StrikeSide {
  sell: {
    IV: number;
    quote: Quote;
    disabled: boolean;
  };
  buy: {
    IV: number;
    quote: Quote;
    disabled: boolean;
  };
  delta: number;
  pos: number;
  exposure: number;
  tokenID?: HexString;
}

export interface StrikeOptions {
  strike: number;
  call: StrikeSide;
  put: StrikeSide;
}

export interface OptionSeries {
  expiration: BigNumber;
  strike: BigNumber;
  strikeAsset: HexString;
  underlying: HexString;
  collateral: HexString;
  isPut: boolean;
}

export enum OptionsTradingActionType {
  SET_SELECTED_OPTION,
  SET_OPTION_CHAIN_MODAL_VISIBLE,
  SET_TUTORIAL_INDEX,
  RESET,
}

export type OptionsTradingAction =
  | {
      type: OptionsTradingActionType.SET_SELECTED_OPTION;
      option?: SelectedOption;
    }
  | {
      type: OptionsTradingActionType.SET_OPTION_CHAIN_MODAL_VISIBLE;
      visible?: OptionChainModalActions;
    }
  | {
      type: OptionsTradingActionType.SET_TUTORIAL_INDEX;
      index?: number;
    }
  | {
      type: OptionsTradingActionType.RESET;
    };
