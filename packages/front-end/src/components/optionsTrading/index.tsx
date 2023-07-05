import { AnimatePresence, LayoutGroup } from "framer-motion";

import { OptionChainModalActions } from "src/state/types";

import { ActiveExpiryAlerts } from "./ActiveExpiryAlerts";
import { AssetPriceInfo } from "./AssetPriceInfo";
import { Chain } from "./Chain";
import { ExpiryDatePicker } from "./ExpiryDatePicker";
import { Filters } from "./Filters/Filters";
import { AdjustCollateralModal } from "./Modals/AdjustCollateralModal";
import { BuyOptionModal } from "./Modals/BuyOptionModal";
import { CloseOptionModal } from "./Modals/CloseOptionModal";
import { CloseShortOptionModal } from "./Modals/CloseShortOptionModal";
import { OperatorModal } from "./Modals/OperatorModal";
import { SellOptionModal } from "./Modals/SellOptionModal";
import { BuyModalTutorial } from "./Tutorials/Buy";
import { OptionChainTutorial } from "./Tutorials/Chain";
import { SellModalTutorial } from "./Tutorials/Sell";
import { UserStats } from "./UserStats";
import { useModal } from "./hooks/useModal";

export const OptionsTradingContent = () => {
  const [modalType] = useModal();

  return (
    <>
      <section className="col-start-1 col-end-17">
        <BuyModalTutorial />
        <OptionChainTutorial />
        <SellModalTutorial />

        <AssetPriceInfo />

        <LayoutGroup>
          <div className="relative border-2 border-black">
            <ExpiryDatePicker />
            <Filters />
            <ActiveExpiryAlerts />
            <Chain />
          </div>
        </LayoutGroup>

        <AnimatePresence mode="wait">
          {modalType === OptionChainModalActions.ADJUST_COLLATERAL && (
            <AdjustCollateralModal />
          )}
          {modalType === OptionChainModalActions.BUY && <BuyOptionModal />}
          {modalType === OptionChainModalActions.CLOSE && <CloseOptionModal />}
          {modalType === OptionChainModalActions.CLOSE_SHORT && (
            <CloseShortOptionModal />
          )}
          {modalType === OptionChainModalActions.OPERATOR && <OperatorModal />}
          {modalType === OptionChainModalActions.SELL && <SellOptionModal />}
        </AnimatePresence>
      </section>

      <UserStats />
    </>
  );
};
