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
    case ActionType.SET_CONNECT_WALLET_INDICATOR_IS_ACTIVE:
      return {
        ...state,
        connectWalletIndicatorActive: action.isActive,
      };
    case ActionType.SET_SETTINGS:
      return {
        ...state,
        settings: { ...state.settings, ...action.settings },
      };
  }
};

export const optionsTradingReducer: Reducer<
  OptionsTradingState,
  OptionsTradingAction
> = (state, action) => {
  switch (action.type) {
    case OptionsTradingActionType.SET_OPTION_TYPE:
      return {
        ...state,
        optionType: action.optionType,
        customOptionStrikes: [],
      };
    case OptionsTradingActionType.SET_EXPIRY_DATE:
      return { ...state, expiryDate: action.date };
    case OptionsTradingActionType.SET_SELECTED_OPTION:
      return { ...state, selectedOption: action.option };
    case OptionsTradingActionType.ADD_CUSTOM_STRIKE:
      return {
        ...state,
        customOptionStrikes: [...state.customOptionStrikes, action.strike],
      };
  }
};
