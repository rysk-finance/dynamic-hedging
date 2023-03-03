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
export const useSellModal = () => {
  const [searchParams] = useSearchParams();
  const {
    state: { userOptionPositions },
  } = useGlobalContext();
  const {
    state: { sellModalOpen },
    dispatch,
  } = useOptionsTradingContext();

  useEffect(() => {
    const hasSellRef = searchParams.get("ref") === "sell";
    const hasUserPosition = userOptionPositions.find(
      ({ otokenId }) => otokenId === searchParams.get("token")
    );

    if (hasSellRef && hasUserPosition) {
      dispatch({
        type: OptionsTradingActionType.SET_SELL_MODAL_VISIBLE,
        visible: true,
      });
    }
  }, [searchParams]);

  return [sellModalOpen] as const;
};
