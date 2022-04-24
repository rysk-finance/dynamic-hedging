import { Reducer } from "react";
import {
  ActionType,
  GlobalAction,
  GlobalState,
  OptionsTradingState,
  OptionsTradingAction,
  OptionsTradingActionType,
} from "./types";

export const globalReducer: Reducer<GlobalState, GlobalAction> = (
  state,
  action
) => {
  switch (action.type) {
    case ActionType.SET_ETH_PRICE:
      return {
        ...state,
        ethPrice: action.price,
        eth24hChange: action.change ?? state.eth24hChange,
      };
  }
};

export const optionsTradingReducer: Reducer<
  OptionsTradingState,
  OptionsTradingAction
> = (state, action) => {
  switch (action.type) {
    case OptionsTradingActionType.SET_OPTION_TYPE:
      return { ...state, optionType: action.optionType };
  }
};
