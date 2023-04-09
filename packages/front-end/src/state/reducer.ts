import {
  GlobalAction,
  GlobalState,
  OptionChainModalActions,
  OptionsTradingAction,
  OptionsTradingState,
  VaultAction,
  VaultState,
} from "./types";

import { Reducer } from "react";

import { defaultGlobalState } from "./GlobalContext";
import { defaultOptionTradingState } from "./OptionsTradingContext";
import { ActionType, OptionsTradingActionType, VaultActionType } from "./types";

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
    case ActionType.SET_UNSTOPPABLE_DOMAIN:
      return {
        ...state,
        unstoppableDomain: action.unstoppableDomain,
      };
    case ActionType.SET_OPTIONS:
      return {
        ...state,
        options: {
          activeExpiry: action.activeExpiry || state.options.activeExpiry,
          data: action.data || state.options.data,
          error: action.error || state.options.error,
          expiries: action.expiries || state.options.expiries,
          isOperator: action.isOperator ?? state.options.isOperator,
          loading: action.loading ?? state.options.loading,
          refresh: action.refresh || state.options.refresh,
          userPositions: action.userPositions || state.options.userPositions,
          vaults: action.vaults || state.options.vaults,
        },
      };
    case ActionType.SET_VISIBLE_STRIKE_RANGE:
      return {
        ...state,
        visibleStrikeRange:
          action.visibleStrikeRange || defaultGlobalState.visibleStrikeRange,
      };
    case ActionType.SET_VISIBLE_COLUMNS:
      const newSet = new Set(state.visibleColumns);

      if (action.column) {
        newSet.has(action.column)
          ? newSet.delete(action.column)
          : newSet.add(action.column);

        return {
          ...state,
          visibleColumns: newSet,
        };
      } else {
        return {
          ...state,
          visibleColumns: defaultGlobalState.visibleColumns,
        };
      }
    case ActionType.SET_COLLATERAL_PREFERENCES:
      if (action.collateralPreferences) {
        return {
          ...state,
          collateralPreferences: action.collateralPreferences,
        };
      } else {
        return {
          ...state,
          collateralPreferences: defaultGlobalState.collateralPreferences,
        };
      }
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
    case OptionsTradingActionType.SET_SELECTED_OPTION:
      return { ...state, selectedOption: action.option };
    case OptionsTradingActionType.SET_OPTION_CHAIN_MODAL_VISIBLE:
      return {
        ...state,
        optionChainModalOpen: action.visible,
      };
    case OptionsTradingActionType.SET_TUTORIAL_INDEX:
      return {
        ...state,
        tutorialIndex: action.index,
      };
    case OptionsTradingActionType.RESET:
      return defaultOptionTradingState;
    case OptionsTradingActionType.CHANGE_FROM_BUYING_OR_SELLING:
      if (state.selectedOption) {
        if (action.visible === OptionChainModalActions.BUY) {
          return {
            ...state,
            optionChainModalOpen: action.visible,
            selectedOption: { ...state.selectedOption, buyOrSell: "buy" },
          };
        } else {
          return {
            ...state,
            optionChainModalOpen: action.visible,
            selectedOption: { ...state.selectedOption, buyOrSell: "sell" },
          };
        }
      } else {
        return state;
      }
  }
};
