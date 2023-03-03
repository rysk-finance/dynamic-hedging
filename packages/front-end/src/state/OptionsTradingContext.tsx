import type { PropsWithChildren } from "react";

import type {
  ColumNames,
  OptionsTradingContext,
  OptionsTradingState,
} from "./types";

import { createContext, useContext, useReducer } from "react";

import { optionsTradingReducer } from "./reducer";
import { OptionType } from "./types";

export const defaultOptionTradingState: OptionsTradingState = {
  optionType: OptionType.CALL,
  expiryDate: null,
  optionParams: null,
  customOptionStrikes: [],
  selectedOption: null,
  visibleStrikeRange: ["", ""],
  visibleColumns: new Set([
    "bid",
    "ask",
    "bid iv",
    "ask iv",
    "delta",
    "pos",
  ] as ColumNames[]),
  chainData: {},
  sellModalOpen: false,
};

export const OptionsTradingReactContext = createContext<OptionsTradingContext>({
  state: defaultOptionTradingState,
  dispatch: () => {},
});

export const OptionsTradingProvider = ({
  children,
}: PropsWithChildren<unknown>) => {
  const [state, dispatch] = useReducer(
    optionsTradingReducer,
    defaultOptionTradingState
  );

  return (
    <OptionsTradingReactContext.Provider value={{ state, dispatch }}>
      {children}
    </OptionsTradingReactContext.Provider>
  );
};

export const useOptionsTradingContext = () =>
  useContext(OptionsTradingReactContext);
