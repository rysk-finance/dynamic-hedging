import React, { createContext, useContext, useReducer } from "react";
import { optionsTradingReducer } from "./reducer";
import {
  OptionsTradingContext,
  OptionsTradingState,
  OptionType,
} from "./types";

export const defaultOptionTradingState: OptionsTradingState = {
  optionType: OptionType.CALL,
  expiryDate: null,
  selectedOption: null,
};

export const OptionsTradingReactContext = createContext<OptionsTradingContext>({
  state: defaultOptionTradingState,
  dispatch: () => {},
});

export const OptionsTradingProvider: React.FC = ({ children }) => {
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
