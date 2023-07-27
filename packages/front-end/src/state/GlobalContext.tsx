import type { PropsWithChildren } from "react";

import type {
  AppSettings,
  ColumnNames,
  ColumnNamesSet,
  GlobalContext,
  GlobalState,
  UserStats,
  UserTradingPreferences,
} from "./types";

import dayjs from "dayjs";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";

import { LOCAL_STORAGE_SETTINGS_KEY } from "../components/dashboard/Settings";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { globalReducer } from "./reducer";
import { ActionType } from "./types";

// Trading preferences
import { ActivePositionSort } from "./constants";
import {
  getLocalStorageObject,
  getLocalStorageSet,
  LocalStorageKeys,
} from "./localStorage";

export const defaultSpotShock = 0.7;
export const defaultTimesToExpiry = [
  604800, 1209600, 2419200, 3628800, 4838400, 6048000, 7257600,
];

export const defaultGlobalState: GlobalState = {
  ethPrice: null,
  eth24hChange: 0,
  eth24hHigh: null,
  eth24hLow: null,
  ethPriceUpdateTime: null,
  ethPriceError: false,
  ethLastUpdateTimestamp: dayjs().unix(),
  userPositionValue: null,
  positionBreakdown: {
    redeemedShares: null,
    usdcOnHold: null,
    pendingWithdrawShares: null,
    unredeemedShares: null,
    currentWithdrawSharePrice: null,
  },
  connectWalletIndicatorActive: false,
  settings: {
    vaultDepositUnlimitedApproval: false,
    optionsTradingUnlimitedApproval: false,
  },
  unstoppableDomain: null,

  // Data related to useInitialData hook.
  options: {
    activeExpiry: undefined,
    data: {},
    error: undefined,
    expiries: [],
    isOperator: false,
    liquidityPool: {
      collateralCap: 0,
      remainingBeforeBuffer: 0,
      totalAssets: 0,
      utilisationHigh: false,
    },
    loading: true,
    refresh: () => {},
    spotShock: {
      call: {
        USDC: defaultSpotShock,
        WETH: defaultSpotShock,
      },
      put: {
        USDC: defaultSpotShock,
        WETH: defaultSpotShock,
      },
    },
    timesToExpiry: {
      call: {
        USDC: defaultTimesToExpiry,
        WETH: defaultTimesToExpiry,
      },
      put: {
        USDC: defaultTimesToExpiry,
        WETH: defaultTimesToExpiry,
      },
    },
    userPositions: {},
    vaults: { length: 0 },
    wethOracleHashMap: {},
  },

  // Options chain state.
  collateralPreferences: {
    amount: 2,
    full: false,
    type: "USDC",
  },
  adjustingOption: undefined,
  closingOption: undefined,
  selectedOption: undefined,
  optionChainModalOpen: undefined,
  visibleColumns: getLocalStorageSet<ColumnNamesSet>(
    LocalStorageKeys.OPTION_CHAIN_FILTERS,
    new Set<ColumnNames>([
      "sell",
      "buy",
      "iv sell",
      "iv buy",
      "delta",
      "pos",
      "exposure",
    ])
  ),
  userTradingPreferences: getLocalStorageObject<UserTradingPreferences>(
    LocalStorageKeys.TRADING_PREFERENCES,
    {
      approvals: false,
      calendarMode: false,
      dhvBalance: false,
      tutorialMode: false,
      untradeableStrikes: false,
    }
  ),

  // User balances
  balances: {
    ETH: 0,
    USDC: 0,
    WETH: 0,
  },

  // User geo-location details
  geoData: {
    blocked: false,
    country: undefined,
  },

  // User stats
  userStats: {
    activePnL: 0,
    activePositions: [],
    activePositionsFilters: {
      ...getLocalStorageObject<
        Pick<UserStats["activePositionsFilters"], "compact">
      >(LocalStorageKeys.ACTIVE_POSITIONS_FILTERS_COMPACT, { compact: true }),
      ...getLocalStorageObject<
        Pick<UserStats["activePositionsFilters"], "hideExpired">
      >(LocalStorageKeys.ACTIVE_POSITIONS_FILTERS_HIDE_EXPIRED, {
        hideExpired: false,
      }),
      ...getLocalStorageObject<
        Pick<UserStats["activePositionsFilters"], "isAscending" | "sort">
      >(LocalStorageKeys.ACTIVE_POSITIONS_FILTERS_SORTING, {
        isAscending: true,
        sort: ActivePositionSort.Expiry,
      }),
    },
    delta: 0,
    historicalPnL: 0,
    inactivePositions: [],
    inactivePositionsFilters: getLocalStorageObject<
      UserStats["inactivePositionsFilters"]
    >(LocalStorageKeys.INACTIVE_POSITIONS_FILTERS_COMPACT, { compact: true }),
    loading: true,
  },
};

export const GlobalReactContext = createContext<GlobalContext>({
  state: defaultGlobalState,
  dispatch: () => {},
});

export const GlobalContextProvider = ({
  children,
}: PropsWithChildren<unknown>) => {
  const [state, dispatch] = useReducer(globalReducer, defaultGlobalState);
  const [getFromLocalStorage] = useLocalStorage();

  const getSettings = useCallback(() => {
    return getFromLocalStorage<AppSettings>(LOCAL_STORAGE_SETTINGS_KEY);
  }, [getFromLocalStorage]);

  useEffect(() => {
    const settings = getSettings();
    if (settings) {
      dispatch({ type: ActionType.SET_SETTINGS, settings });
    }
  }, [dispatch, getSettings]);

  return (
    <GlobalReactContext.Provider value={{ state, dispatch }}>
      {children}
    </GlobalReactContext.Provider>
  );
};

export const useGlobalContext = () => useContext(GlobalReactContext);
