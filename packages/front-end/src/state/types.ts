import type { ApolloError } from "@apollo/client";
import type { BigNumber, BigNumberish } from "ethers";

import type { PositionOToken, Vault } from "src/hooks/useInitialData/types";

import { Dispatch, ReactNode } from "react";

export type AppSettings = {
  vaultDepositUnlimitedApproval: boolean;
  optionsTradingUnlimitedApproval: boolean;
};

// Types related to useInitialData hook.
export type Expiries = string[];

interface UserPositionToken extends PositionOToken {
  netAmount: BigNumberish;
  totalPremium: number;
  vault?: Vault;
}

export interface UserPositions {
  [expiry: string]: {
    netAmount: BigNumberish;
    isLong: boolean;
    isShort: boolean;
    tokens: UserPositionToken[];
  };
}

export interface FullPosition {
  amount: number;
  createdAt: string;
  entryPrice: string;
  expired: boolean;
  expiryPrice?: string;
  liquidationPrice: number;
  id: string;
  isPut: boolean;
  isRedeemable: boolean;
  otokenId: string;
  side: string;
  status: string | ReactNode;
  strikePrice: string;
  symbol: string;
  totalPremium: number;
  underlyingAsset: string;
  isSettleable: boolean;
  vaultId: string;
  collateralAsset: string;
  expiryTimestamp: string;
  collateralAmount: string;
  pnl: number;
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

export interface SpotShock {
  call: {
    USDC: number;
    WETH: number;
  };
  put: {
    USDC: number;
    WETH: number;
  };
}

export interface TimesToExpiry {
  call: {
    USDC: number[];
    WETH: number[];
  };
  put: {
    USDC: number[];
    WETH: number[];
  };
}

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

export interface CollateralPreferences {
  amount: number;
  full: boolean;
  type: CollateralType;
}

export interface UserVaults {
  [oTokenAddress: HexString]: string;
  length: number;
}

export interface Balances {
  ETH: number;
  USDC: number;
  WETH: number;
}

export interface LiquidityPool {
  remainingBeforeBuffer: number;
}

// Global context
export type GlobalState = {
  ethPrice: number | null;
  eth24hChange: number;
  eth24hHigh: number | null;
  eth24hLow: number | null;
  ethPriceUpdateTime: Date | null;
  ethPriceError: boolean;
  ethLastUpdateTimestamp: number;
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
    liquidityPool: LiquidityPool;
    loading: boolean;
    refresh: () => void;
    spotShock: SpotShock;
    timesToExpiry: TimesToExpiry;
    userPositions: UserPositions;
    vaults: UserVaults;
  };

  dashboard: {
    activePositions: FullPosition[];
    inactivePositions: FullPosition[];
    modalPosition?: FullPosition;
  };

  // Options chain state.
  collateralPreferences: CollateralPreferences;
  selectedOption?: SelectedOption;
  optionChainModalOpen?: OptionChainModal;
  buyTutorialIndex?: number;
  chainTutorialIndex?: number;
  sellTutorialIndex?: number;
  visibleStrikeRange: StrikeRangeTuple;
  visibleColumns: Set<ColumNames>;
  dashboardModalOpen?: DashboardModal;

  // User balances
  balances: Balances;
};

export enum ActionType {
  SET_ETH_PRICE,
  SET_ETH_PRICE_ERROR,
  SET_ETH_PRICE_LAST_UPDATED,
  SET_POSITION_VALUE,
  SET_POSITION_BREAKDOWN,
  SET_CONNECT_WALLET_INDICATOR_IS_ACTIVE,
  SET_SETTINGS,
  SET_UNSTOPPABLE_DOMAIN,

  // Actions related to useInitialData hook.
  SET_OPTIONS,

  // Actions related to dashboard state.
  SET_DASHBOARD,

  // Actions related to options chain state.
  SET_VISIBLE_STRIKE_RANGE,
  SET_VISIBLE_COLUMNS,
  SET_COLLATERAL_PREFERENCES,
  SET_DASHBOARD_MODAL_VISIBLE,
  SET_SELECTED_OPTION,
  SET_OPTION_CHAIN_MODAL_VISIBLE,
  SET_BUY_TUTORIAL_INDEX,
  SET_CHAIN_TUTORIAL_INDEX,
  SET_SELL_TUTORIAL_INDEX,
  RESET_OPTIONS_CHAIN_STATE,
  CHANGE_FROM_BUYING_OR_SELLING,

  // User balances
  SET_USER_BALANCES,
}

export enum DashboardModalActions {
  ADJUST_COLLATERAL = "adjustCollateral",
}

type DashboardModal =
  (typeof DashboardModalActions)[keyof typeof DashboardModalActions];

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
      type: ActionType.SET_ETH_PRICE_LAST_UPDATED;
      timestamp: number;
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
      liquidityPool?: LiquidityPool;
      loading?: boolean;
      refresh?: () => void;
      spotShock?: SpotShock;
      timesToExpiry?: TimesToExpiry;
      userPositions?: UserPositions;
      vaults?: UserVaults;
    }
  | {
      type: ActionType.SET_DASHBOARD;
      activePositions?: FullPosition[];
      inactivePositions?: FullPosition[];
      modalPosition?: FullPosition;
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
    }
  | {
      type: ActionType.SET_SELECTED_OPTION;
      option?: SelectedOption;
    }
  | {
      type: ActionType.SET_OPTION_CHAIN_MODAL_VISIBLE;
      visible?: OptionChainModalActions;
    }
  | {
      type: ActionType.SET_BUY_TUTORIAL_INDEX;
      index?: number;
    }
  | {
      type: ActionType.SET_CHAIN_TUTORIAL_INDEX;
      index?: number;
    }
  | {
      type: ActionType.SET_SELL_TUTORIAL_INDEX;
      index?: number;
    }
  | {
      type: ActionType.RESET_OPTIONS_CHAIN_STATE;
    }
  | {
      type: ActionType.CHANGE_FROM_BUYING_OR_SELLING;
      visible:
        | OptionChainModalActions.BUY
        | OptionChainModalActions.SELL
        | OptionChainModalActions.OPERATOR;
    }
  | {
      type: ActionType.SET_DASHBOARD_MODAL_VISIBLE;
      visible?: DashboardModalActions;
    }
  | {
      type: ActionType.SET_USER_BALANCES;
      balances: Balances;
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
  chainTutorialIndex?: number;
};

export enum OptionChainModalActions {
  BUY = "buy",
  CLOSE = "close",
  OPERATOR = "operator",
  SELL = "sell",
  CLOSE_SHORT = "closeShort",
}

type OptionChainModal =
  (typeof OptionChainModalActions)[keyof typeof OptionChainModalActions];

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
