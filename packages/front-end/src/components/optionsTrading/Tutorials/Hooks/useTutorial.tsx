import { ACTIONS, STATUS } from "react-joyride";

import { useEffect } from "react";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

export const useTutorial = (
  action:
    | ActionType.SET_BUY_TUTORIAL_INDEX
    | ActionType.SET_CHAIN_TUTORIAL_INDEX
    | ActionType.SET_SELL_TUTORIAL_INDEX,
  index?: number
) => {
  const { dispatch } = useGlobalContext();

  const handleCallback = (data: any) => {
    if (
      data.status === STATUS.FINISHED ||
      data.status === STATUS.SKIPPED ||
      data.action === ACTIONS.CLOSE
    ) {
      dispatch({
        type: action,
        index: undefined,
      });
    }
  };

  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", index !== undefined);
  }, [index]);

  return [handleCallback] as const;
};
