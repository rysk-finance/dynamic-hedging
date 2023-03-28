import { AnimatePresence, LayoutGroup } from "framer-motion";

import { AssetPriceInfo } from "./AssetPriceInfo";
import { Chain } from "./Chain";
import { CloseOptionModal } from "./Modals/CloseOptionModal";
import { ExpiryDatePicker } from "./ExpiryDatePicker";
import { Filters } from "./Filters/Filters";
import { useCloseModal } from "./hooks/useCloseModal";
import { Purchase } from "./Purchase";
import { Tutorial } from "./Tutorial";

export const OptionsTradingContent = () => {
  const [closeModalOpen] = useCloseModal();

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

      <Purchase />

      <AnimatePresence mode="wait">
        {closeModalOpen && <CloseOptionModal />}
      </AnimatePresence>
    </section>
  );
};
