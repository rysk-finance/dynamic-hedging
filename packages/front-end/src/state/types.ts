import { Dispatch } from "react";

export type GlobalState = {
  ethPrice: number | null;
};

export enum ActionType {
  SET_ETH_PRICE,
}

export type GlobalAction = { type: ActionType.SET_ETH_PRICE; price: number };

export type GlobalContext = {
  state: GlobalState;
  dispatch: Dispatch<GlobalAction>;
};
