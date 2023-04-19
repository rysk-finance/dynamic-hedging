import { AnimatePresence } from "framer-motion";

import { DashboardModalActions } from "src/state/types";

import { useModal } from "./hooks/useModal";
import { UserVault } from "./UserVault";
import { UserEpochPNL } from "./UserEpochPNL/UserEpochPNL";
import { UserOptions } from "./OptionsTable/OptionsTable";
import AdjustCollateralModal from "./Modals/AdjustCollateralModal";

export const DashboardContent = () => {
  const [modalType] = useModal();

  return (
    <div className="table col-start-1 col-end-17">
      <UserVault />
      <UserEpochPNL />
      <UserOptions />

      <AnimatePresence mode="wait">
        {modalType === DashboardModalActions.ADJUST_COLLATERAL && (
          <AdjustCollateralModal />
        )}
      </AnimatePresence>
    </div>
  );
};
