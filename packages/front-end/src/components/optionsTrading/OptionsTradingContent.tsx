import { AnimatePresence, LayoutGroup } from "framer-motion";

import { OptionChainModalActions } from "src/state/types";

import { AssetPriceInfo } from "./AssetPriceInfo";
import { Chain } from "./Chain";
import { ExpiryDatePicker } from "./ExpiryDatePicker";
import { Filters } from "./Filters/Filters";
import { useModal } from "./hooks/useModal";
import { BuyOptionModal } from "./Modals/BuyOptionModal";
import { CloseOptionModal } from "./Modals/CloseOptionModal";
import { Purchase } from "./Purchase";
import { Tutorial } from "./Tutorial";

export const OptionsTradingContent = () => {
  const [modalType] = useModal();

  return (
    <section className="col-start-1 col-end-17 -mt-16">
      <Tutorial />

      <AssetPriceInfo />

      <LayoutGroup>
        <div className="relative border-2 border-black">
          <ExpiryDatePicker />
          <Filters />
          <Chain />
        </div>
      </LayoutGroup>

      {/* <Purchase /> */}

      <AnimatePresence mode="wait">
        {modalType === OptionChainModalActions.CLOSE && <CloseOptionModal />}
        {modalType === OptionChainModalActions.BUY && <BuyOptionModal />}
      </AnimatePresence>
    </section>
  );
};
