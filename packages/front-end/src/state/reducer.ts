import { Reducer } from "react";
import { ActionType, GlobalAction, GlobalState } from "./types";

export const globalReducer: Reducer<GlobalState, GlobalAction> = (
  state,
  action
) => {
  switch (action.type) {
    case ActionType.SET_ETH_PRICE:
      return { ...state, ethPrice: action.price };
  }
};
