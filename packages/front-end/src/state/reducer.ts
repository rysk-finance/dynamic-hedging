import {
  GlobalAction,
  GlobalState,
  OptionChainModalActions,
  VaultAction,
  VaultState,
} from "./types";

import { Reducer } from "react";

import { defaultGlobalState } from "./GlobalContext";
import { ActionType, VaultActionType } from "./types";

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
    case ActionType.SET_ETH_PRICE_LAST_UPDATED:
      return {
        ...state,
        ethLastUpdateTimestamp: action.timestamp,
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
          liquidityPool: action.liquidityPool || state.options.liquidityPool,
          loading: action.loading ?? state.options.loading,
          refresh: action.refresh || state.options.refresh,
          spotShock: action.spotShock || state.options.spotShock,
          timesToExpiry: action.timesToExpiry || state.options.timesToExpiry,
          userPositions: action.userPositions || state.options.userPositions,
          wethOracleHashMap:
            action.wethOracleHashMap || state.options.wethOracleHashMap,
        },
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
    case ActionType.SET_SELECTED_OPTION:
      return {
        ...state,
        options: {
          ...state.options,
          activeExpiry: action.activeExpiry || state.options.activeExpiry,
        },
        selectedOption: action.option,
      };
    case ActionType.SET_ADJUSTING_OPTION:
      return {
        ...state,
        adjustingOption: action.option,
      };
    case ActionType.SET_CLOSING_OPTION:
      return {
        ...state,
        closingOption: action.option,
        options: { ...state.options, activeExpiry: action.expiry },
      };
    case ActionType.SET_OPTION_CHAIN_MODAL_VISIBLE:
      return {
        ...state,
        optionChainModalOpen: action.visible,
      };
    case ActionType.RESET_OPTIONS_CHAIN_STATE:
      return {
        ...state,
        adjustingOption: defaultGlobalState.adjustingOption,
        closingOption: defaultGlobalState.closingOption,
        selectedOption: defaultGlobalState.selectedOption,
        optionChainModalOpen: defaultGlobalState.optionChainModalOpen,
      };
    case ActionType.CHANGE_FROM_BUYING_OR_SELLING:
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
    case ActionType.SET_USER_BALANCES:
      return {
        ...state,
        balances: action.balances,
      };
    case ActionType.SET_USER_GEO_DATA:
      return {
        ...state,
        geoData: action.geoData,
      };
    case ActionType.SET_USER_STATS:
      return {
        ...state,
        userStats: {
          activePnL: action.activePnL ?? state.userStats.activePnL,
          activePositions:
            action.activePositions || state.userStats.activePositions,
          activePositionsFilters: {
            compact:
              action.activePositionsFilters?.compact ??
              state.userStats.activePositionsFilters.compact,
            hideExpired:
              action.activePositionsFilters?.hideExpired ??
              state.userStats.activePositionsFilters.hideExpired,
            returnFormat:
              action.activePositionsFilters?.returnFormat ??
              state.userStats.activePositionsFilters.returnFormat,
            isAscending:
              action.activePositionsFilters?.isAscending ??
              state.userStats.activePositionsFilters.isAscending,
            sort:
              action.activePositionsFilters?.sort ||
              state.userStats.activePositionsFilters.sort,
          },
          delta: action.delta ?? state.userStats.delta,
          historicalPnL: action.historicalPnL ?? state.userStats.historicalPnL,
          inactivePositions:
            action.inactivePositions ?? state.userStats.inactivePositions,
          inactivePositionsFilters: {
            compact:
              action.inactivePositionsFilters?.compact ??
              state.userStats.inactivePositionsFilters.compact,
          },
          loading: action.loading ?? state.userStats.loading,
        },
      };
    case ActionType.SET_USER_TRADING_PREFERENCES:
      return {
        ...state,
        userTradingPreferences: {
          ...state.userTradingPreferences,
          ...action.userTradingPreferences,
        },
      };
    case ActionType.SET_NATIVE_USDC_BANNER_VISIBLE:
      return {
        ...state,
        nativeUSDCBannerVisible: action.visible,
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
