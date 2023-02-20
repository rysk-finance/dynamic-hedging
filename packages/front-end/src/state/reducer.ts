import { Reducer } from "react";
import {
  ActionType,
  GlobalAction,
  GlobalState,
  OptionsTradingState,
  OptionsTradingAction,
  OptionsTradingActionType,
  VaultAction,
  VaultState,
  VaultActionType,
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
        ethPriceUpdateTime: action.date,
        eth24hHigh: action.high,
        eth24hLow: action.low,
        ethPriceError: action.error,
      };
    case ActionType.SET_ETH_PRICE_ERROR:
      return {
        ...state,
        ethPriceError: action.error,
      };
    case ActionType.SET_POSITION_VALUE:
      return {
        ...state,
        userPositionValue: action.value,
      };
    case ActionType.SET_POSITION_BREAKDOWN:
      return {
        ...state,
        positionBreakdown: { ...state.positionBreakdown, ...action.values },
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
    case ActionType.RESET_GLOBAL_STATE:
      return {
        ...state,
        userPositionValue: null,
        positionBreakdown: {
          currentWithdrawSharePrice: null,
          pendingWithdrawShares: null,
          redeemedShares: null,
          unredeemedShares: null,
          usdcOnHold: null,
        },
      };
  }
};

export const vaultReducer: Reducer<VaultState, VaultAction> = (
  state,
  action
) => {
  switch (action.type) {
    case VaultActionType.SET:
      return {
        ...state,
        ...action.data,
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
    case OptionsTradingActionType.SET_OPTION_PARAMS:
      return {
        ...state,
        optionParams: action.params,
      };
  }
};
