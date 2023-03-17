import { AnimatePresence } from "framer-motion";

import { AssetPriceInfo } from "./AssetPriceInfo";
import { Chain } from "./Chain";
import { CloseOptionModal } from "./CloseOptionModal";
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

      <div className="relative border-2 border-black">
        <ExpiryDatePicker />
        <Filters />
        <Chain />
      </div>

      <Purchase />

      <AnimatePresence mode="wait">
        {closeModalOpen && <CloseOptionModal />}
      </AnimatePresence>
    </section>
  );
};
