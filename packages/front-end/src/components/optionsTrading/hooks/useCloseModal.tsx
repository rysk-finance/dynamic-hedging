import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

import { useGlobalContext } from "src/state/GlobalContext";
import { useOptionsTradingContext } from "src/state/OptionsTradingContext";
import { OptionsTradingActionType } from "src/state/types";

/**
 * Hook to check query params and determine if
 * the sell modal should be visible.
 *
 * Returns a boolean value for the modal state.
 *
 * @returns [boolean]
 */
export const useCloseModal = () => {
  const [searchParams] = useSearchParams();

  const {
    state: {
      options: { activeExpiry, userPositions },
    },
  } = useGlobalContext();

  const {
    state: { sellModalOpen },
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
          type: OptionsTradingActionType.SET_SELL_MODAL_VISIBLE,
          visible: true,
        });
      }
    }
  }, [activeExpiry, searchParams]);

  return [sellModalOpen] as const;
};
