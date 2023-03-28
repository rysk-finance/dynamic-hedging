import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { useGlobalContext } from "src/state/GlobalContext";
import { useOptionsTradingContext } from "src/state/OptionsTradingContext";
import {
  OptionChainModalActions,
  OptionsTradingActionType,
} from "src/state/types";

/**
 * Hook that checks query params and state to determine if
 * the modal should be visible.
 *
 * The buy/sell modal are keyed from the `selectedOption`
 * state variable.
 *
 * The close long position modal is keyed from query params.
 *
 * Returns a boolean value for the modal state.
 *
 * @returns [boolean]
 */
export const useModal = () => {
  const [searchParams] = useSearchParams();

  const {
    state: {
      options: { activeExpiry, userPositions },
    },
  } = useGlobalContext();

  const {
    state: { optionChainModalOpen, selectedOption },
    dispatch,
  } = useOptionsTradingContext();

  useEffect(() => {
    if (activeExpiry) {
      const hasSellRef = searchParams.get("ref") === "close";
      const hasUserPosition = userPositions[activeExpiry]?.tokens.find(
        ({ id }) => id === searchParams.get("token")
      );

      if (hasSellRef && hasUserPosition) {
        dispatch({
          type: OptionsTradingActionType.SET_OPTION_CHAIN_MODAL_VISIBLE,
          visible: OptionChainModalActions.CLOSE,
        });
      } else if (selectedOption) {
        // do stuff here
      }
    }
  }, [activeExpiry, searchParams, selectedOption]);

  return [optionChainModalOpen] as const;
};
