import type {
  GlobalAction,
  GlobalState,
  OptionsTradingAction,
  OptionsTradingState,
  VaultAction,
  VaultState,
} from "./types";

import { Reducer } from "react";

import { ActionType, OptionsTradingActionType, VaultActionType } from "./types";
import { defaultOptionTradingState } from "./OptionsTradingContext";

export const globalReducer: Reducer<GlobalState, GlobalAction> = (
  state,
  action
) => {
  switch (action.type) {
    case ActionType.SET_ETH_PRICE:
      return {
        ...state,
        ethPrice: action.price,
        eth24hChange: action.change || state.eth24hChange,
        ethPriceUpdateTime: action.date,
        eth24hHigh: action.high || state.eth24hHigh,
        eth24hLow: action.low || state.eth24hLow,
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
        userOptionPositions: [],
        userPositionValue: null,
        positionBreakdown: {
          currentWithdrawSharePrice: null,
          pendingWithdrawShares: null,
          redeemedShares: null,
          unredeemedShares: null,
          usdcOnHold: null,
        },
      };
    case ActionType.SET_USER_OPTION_POSITIONS:
      return {
        ...state,
        userOptionPositions: action.userOptionPositions,
      };
    case ActionType.SET_UNSTOPPABLE_DOMAIN:
      return {
        ...state,
        unstoppableDomain: action.unstoppableDomain,
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
    case OptionsTradingActionType.SET_VISIBLE_STRIKE_RANGE:
      return {
        ...state,
        visibleStrikeRange: action.visibleStrikeRange,
      };
    case OptionsTradingActionType.RESET_VISIBLE_STRIKE_RANGE:
      return {
        ...state,
        visibleStrikeRange: defaultOptionTradingState.visibleStrikeRange,
      };
    case OptionsTradingActionType.SET_VISIBLE_COLUMNS:
      const newSet = new Set(state.visibleColumns);

      newSet.has(action.column)
        ? newSet.delete(action.column)
        : newSet.add(action.column);

      return {
        ...state,
        visibleColumns: newSet,
      };
    case OptionsTradingActionType.RESET_VISIBLE_COLUMNS:
      return {
        ...state,
        visibleColumns: defaultOptionTradingState.visibleColumns,
      };
    case OptionsTradingActionType.SET_CHAIN_DATA_FOR_EXPIRY:
      return {
        ...state,
        chainData: { ...state.chainData, [action.expiry]: action.data },
      };
    case OptionsTradingActionType.SET_SELL_MODAL_VISIBLE:
      return {
        ...state,
        sellModalOpen: action.visible,
      };
    case OptionsTradingActionType.SET_TUTORIAL_INDEX:
      return {
        ...state,
        tutorialIndex: action.index,
      };
  }
};
