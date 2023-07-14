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
import { UserStats } from "./UserStats";
import { useModal } from "./hooks/useModal";

export const OptionsTradingContent = () => {
  const [modalType] = useModal();

  return (
    <>
      <section className="col-start-1 col-end-17">
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
            <AdjustCollateralModal key="adjust-collateral" />
          )}
          {modalType === OptionChainModalActions.BUY && (
            <BuyOptionModal key="buy" />
          )}
          {modalType === OptionChainModalActions.CLOSE_LONG && (
            <CloseOptionModal key="close-long" />
          )}
          {modalType === OptionChainModalActions.CLOSE_SHORT && (
            <CloseShortOptionModal key="close-short" />
          )}
          {modalType === OptionChainModalActions.OPERATOR && (
            <OperatorModal key="operator" />
          )}
          {modalType === OptionChainModalActions.SELL && (
            <SellOptionModal key="sell" />
          )}
        </AnimatePresence>
      </section>

      <UserStats />
    </>
  );
};
