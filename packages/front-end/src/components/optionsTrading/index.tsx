import { AnimatePresence, LayoutGroup } from "framer-motion";

import { OptionChainModalActions } from "src/state/types";

import { AssetPriceInfo } from "./AssetPriceInfo";
import { ActiveExpiryAlerts } from "./ActiveExpiryAlerts";
import { Chain } from "./Chain";
import { ExpiryDatePicker } from "./ExpiryDatePicker";
import { Filters } from "./Filters/Filters";
import { useModal } from "./hooks/useModal";
import { BuyOptionModal } from "./Modals/BuyOptionModal";
import { CloseOptionModal } from "./Modals/CloseOptionModal";
import { OperatorModal } from "./Modals/OperatorModal";
import { SellOptionModal } from "./Modals/SellOptionModal";
import { CloseShortOptionModal } from "./Modals/CloseShortOptionModal";
import { BuyModalTutorial } from "./Tutorials/Buy";
import { OptionChainTutorial } from "./Tutorials/Chain";
import { SellModalTutorial } from "./Tutorials/Sell";

export const OptionsTradingContent = () => {
  const [modalType] = useModal();

  return (
    <section className="col-start-1 col-end-17 -mt-16">
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
        {modalType === OptionChainModalActions.BUY && (
          <BuyOptionModal key="buy" />
        )}
        {modalType === OptionChainModalActions.CLOSE && <CloseOptionModal />}
        {modalType === OptionChainModalActions.CLOSE_SHORT && (
          <CloseShortOptionModal />
        )}
        {modalType === OptionChainModalActions.OPERATOR && <OperatorModal />}
        {modalType === OptionChainModalActions.SELL && (
          <SellOptionModal key="sell" />
        )}
      </AnimatePresence>
    </section>
  );
};
