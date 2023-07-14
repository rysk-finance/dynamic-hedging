import type { ApolloError } from "@apollo/client";
import type { BigNumber, BigNumberish } from "ethers";

import type {
  LiquidateActions,
  PositionOToken,
  RedeemActions,
  SettleActions,
  Vault,
} from "src/hooks/useInitialData/types";

import { Dispatch } from "react";

import { ActivePositionSort } from "./constants";

export type AppSettings = {
  vaultDepositUnlimitedApproval: boolean;
  optionsTradingUnlimitedApproval: boolean;
};

// Types related to useInitialData hook.
export type Expiries = string[];

export interface UserPositionToken extends PositionOToken {
  active: boolean;
  buyAmount?: BigNumberish;
  id: HexString;
  netAmount: BigNumberish;
  totalPremium: number;
  liquidateActions?: LiquidateActions[];
  realizedPnl: BigNumberish;
  redeemActions?: RedeemActions[];
  sellAmount?: BigNumberish;
  settleActions?: SettleActions[];
  vault?: Vault;
}

export interface UserPositions {
  [expiry: string]: {
    netAmount: BigNumberish;
    isLong: boolean;
    isShort: boolean;
    activeTokens: UserPositionToken[];
    inactiveTokens: UserPositionToken[];
    longTokens: UserPositionToken[];
    shortTokens: UserPositionToken[];
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
  collateralCap: number;
  remainingBeforeBuffer: number;
  totalAssets: number;
  utilisationHigh: boolean;
}

export interface GeoData {
  blocked: boolean;
  country?: string;
}

export interface WethOracleHashMap {
  [expiry: string]: number;
}

export interface ActivePositions {
  action: string;
  amount: number;
  breakEven: number;
  collateral: {
    amount: number;
    asset?: CollateralType;
    liquidationPrice: number;
    vault?: Vault;
  };
  disabled: boolean;
  delta: number;
  entry: number;
  expiryTimestamp: string;
  id: HexString;
  isOpen: boolean;
  isPut: boolean;
  isShort: boolean;
  mark: number;
  profitLoss: number;
  series: string;
  strike: string;
}

export interface InactivePositions {
  entry: number;
  id: string;
  isShort: boolean;
  oraclePrice: number;
  profitLoss?: number;
  series: string;
  size: number;
}

export type ActivePositionsSortType = keyof typeof ActivePositionSort;

export interface UserStats {
  activePnL: number;
  activePositions: ActivePositions[];
  activePositionsFilters: {
    compact: boolean;
    hideExpired: boolean;
    isAscending: boolean;
    sort: ActivePositionsSortType;
  };
  delta: number;
  historicalPnL: number;
  inactivePositions: InactivePositions[];
  inactivePositionsFilters: {
    compact: boolean;
  };
  loading: boolean;
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
    wethOracleHashMap: WethOracleHashMap;
  };

  // Options chain state.
  collateralPreferences: CollateralPreferences;
  adjustingOption?: AdjustingOption;
  closingOption?: ClosingOption;
  selectedOption?: SelectedOption;
  optionChainModalOpen?: OptionChainModal;
  buyTutorialIndex?: number;
  chainTutorialIndex?: number;
  sellTutorialIndex?: number;
  visibleColumns: Set<ColumNames>;

  // User balances
  balances: Balances;

  // User geo-location details
  geoData: GeoData;

  // User stats
  userStats: UserStats;
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

  // Actions related to options chain state.
  SET_VISIBLE_COLUMNS,
  SET_COLLATERAL_PREFERENCES,
  SET_ADJUSTING_OPTION,
  SET_SELECTED_OPTION,
  SET_CLOSING_OPTION,
  SET_OPTION_CHAIN_MODAL_VISIBLE,
  SET_BUY_TUTORIAL_INDEX,
  SET_CHAIN_TUTORIAL_INDEX,
  SET_SELL_TUTORIAL_INDEX,
  RESET_OPTIONS_CHAIN_STATE,
  CHANGE_FROM_BUYING_OR_SELLING,

  // User balances
  SET_USER_BALANCES,

  // User geo-location details
  SET_USER_GEO_DATA,

  // User stats
  SET_USER_STATS,
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
      wethOracleHashMap?: WethOracleHashMap;
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
      type: ActionType.SET_ADJUSTING_OPTION;
      option?: AdjustingOption;
    }
  | {
      type: ActionType.SET_CLOSING_OPTION;
      expiry?: string;
      option?: ClosingOption;
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
      type: ActionType.SET_USER_BALANCES;
      balances: Balances;
    }
  | {
      type: ActionType.SET_USER_GEO_DATA;
      geoData: GeoData;
    }
  | {
      type: ActionType.SET_USER_STATS;
      activePnL?: number;
      activePositions?: ActivePositions[];
      activePositionsFilters?: {
        compact?: boolean;
        hideExpired?: boolean;
        isAscending?: boolean;
        sort?: ActivePositionsSortType;
      };
      delta?: number;
      historicalPnL?: number;
      inactivePositions?: InactivePositions[];
      inactivePositionsFilters?: {
        compact?: boolean;
      };
      loading?: boolean;
    };

export type GlobalContext = {
  state: GlobalState;
  dispatch: Dispatch<GlobalAction>;
};

// Vault context
export type VaultState = {
  depositEpoch: BigNumber | null;
  userDHVBalance: BigNumber | null;
  withdrawalEpoch: BigNumber | null;
  withdrawPricePerShare: BigNumber | null;
  withdrawalPricePerShare: BigNumber | null;
  whitelistedAddresses: HexString[];
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
  ADJUST_COLLATERAL = "adjustCollateral",
  BUY = "buy",
  CLOSE_LONG = "closeLong",
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

export interface AdjustingOption {
  address: HexString;
  amount: number;
  asset: CollateralType;
  collateralAmount: number;
  expiryTimestamp: string;
  isPut: boolean;
  liquidationPrice: number;
  series: string;
  strike: number;
  vault: Vault;
}

export interface ClosingOption {
  address: HexString;
  amount: number;
  isPut: boolean;
  isShort: boolean;
  series: string;
  strike: string;
  vault?: Vault;
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
