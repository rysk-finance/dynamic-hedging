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
import {
  ActionType,
  AppSettings,
  CollateralAmount,
  GlobalContext,
  GlobalState,
} from "./types";

export const defaultGlobalState: GlobalState = {
  ethPrice: null,
  eth24hChange: 0,
  eth24hHigh: null,
  eth24hLow: null,
  ethPriceUpdateTime: null,
  ethPriceError: false,
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
        USDC: 0.7,
        WETH: 0.7,
      },
      put: {
        USDC: 0.7,
        WETH: 0.7,
      },
    },
    timesToExpiry: {
      call: {
        USDC: [604800, 1209600, 2419200, 3628800, 4838400, 6048000, 7257600],
        WETH: [604800, 1209600, 2419200, 3628800, 4838400, 6048000, 7257600],
      },
      put: {
        USDC: [604800, 1209600, 2419200, 3628800, 4838400, 6048000, 7257600],
        WETH: [604800, 1209600, 2419200, 3628800, 4838400, 6048000, 7257600],
      },
    },
    userPositions: {},
    vaults: { length: 0 },
  },

  // Options chain state.
  collateralPreferences: {
    type: "USDC",
    amount: CollateralAmount["2x"],
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
