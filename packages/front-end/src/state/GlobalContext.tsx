import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from "react";
import { globalReducer } from "./reducer";
import { ActionType, AppSettings, GlobalContext, GlobalState } from "./types";
import React from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { LOCAL_STORAGE_SETTINGS_KEY } from "../components/dashboard/Settings";

const defaultGlobalState: GlobalState = {
  ethPrice: null,
  eth24hChange: null,
  ethPriceUpdateTime: null,
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
};

export const GlobalReactContext = createContext<GlobalContext>({
  state: defaultGlobalState,
  dispatch: () => {},
});

export const GlobalContextProvider: React.FC = ({ children }) => {
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
