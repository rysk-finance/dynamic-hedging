import type { PropsWithChildren } from "react";

import type { ColumNames } from "./types";

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
import { ActionType, AppSettings, GlobalContext, GlobalState } from "./types";

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
  ethLastUpdateTimestamp: 0,
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
  },

  dashboard: {
    activePositions: [],
    inactivePositions: [],
    modalPosition: undefined,
  },

  // Options chain state.
  collateralPreferences: {
    amount: 2,
    full: false,
    type: "USDC",
  },
  selectedOption: undefined,
  optionChainModalOpen: undefined,
  buyTutorialIndex: undefined,
  chainTutorialIndex: undefined,
  sellTutorialIndex: undefined,
  visibleStrikeRange: ["", ""],
  visibleColumns: new Set([
    "sell",
    "buy",
    "iv sell",
    "iv buy",
    "delta",
    "pos",
    "exposure",
  ] as ColumNames[]),
  dashboardModalOpen: undefined,

  // User balances
  balances: {
    ETH: 0,
    USDC: 0,
    WETH: 0,
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
