import type { ToggleProps } from "../types";

import { RyskTooltip } from "src/components/shared/RyskToolTip";
import { useGlobalContext } from "src/state/GlobalContext";

export const Toggle = ({
  depositToggleState: { isDepositing, setIsDepositing },
}: ToggleProps) => {
  const {
    state: {
      userTradingPreferences: { tutorialMode },
    },
  } = useGlobalContext();

  const handleToggleClick = () =>
    setIsDepositing((currentState) => !currentState);

  return (
    <RyskTooltip
      content="Use this toggle to switch between depositing and withdrawing collateral from your position."
      disabled={!tutorialMode}
      placement="top"
    >
      <span
        className="flex cursor-pointer select-none relative w-48 h-12 p-1 mx-auto my-4 bg-bone-dark rounded-md shadow-[inset_0_0_10px_rgba(0,0,0,0.2)]"
        onClick={handleToggleClick}
      >
        <span
          className={`${
            isDepositing ? "text-white" : "text-black"
          } z-10 relative flex my-auto justify-center w-24 ease-in-out duration-200`}
        >
          {`Deposit`}
        </span>
        <span
          className={`absolute flex self-center justify-center text-white bg-black ${
            isDepositing ? "left-[0.25rem]" : "left-[5.75rem]"
          } h-10 w-24 rounded-md ease-in-out duration-200`}
        />
        <span
          className={`${
            !isDepositing ? "text-white" : "text-black"
          } z-10 relative flex my-auto justify-center w-24 ease-in-out duration-200`}
        >
          {`Withdraw`}
        </span>
      </span>
    </RyskTooltip>
  );
};
