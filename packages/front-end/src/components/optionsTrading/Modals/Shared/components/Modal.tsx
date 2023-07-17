import type { PropsWithChildren } from "react";

import { RyskModal } from "src/components/shared/RyskModal";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

export const Modal = ({ children }: PropsWithChildren) => {
  const { dispatch } = useGlobalContext();

  const handleLightBoxClick = () => {
    dispatch({
      type: ActionType.RESET_OPTIONS_CHAIN_STATE,
    });
  };

  return (
    <RyskModal lightBoxClickFn={handleLightBoxClick}>{children}</RyskModal>
  );
};
