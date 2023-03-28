import type { PropsWithChildren } from "react";

import type {
  ColumNames,
  OptionsTradingContext,
  OptionsTradingState,
} from "./types";

import { createContext, useContext, useReducer } from "react";

import { optionsTradingReducer } from "./reducer";

export const defaultOptionTradingState: OptionsTradingState = {
  selectedOption: null,
  optionChainModalOpen: false,
  tutorialIndex: undefined,
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
