import { AnimatePresence } from "framer-motion";

import { OptionsTable } from "./OptionsTable";
import { Purchase } from "./Purchase";
import { ExpiryDatePicker } from "./ExpiryDatePicker";
import { Filters } from "./Filters/Filters";
import { AssetPriceInfo } from "./AssetPriceInfo";
import { SellOptionModal } from "./SellOptionModal";
import { Tutorial } from "./Tutorial";

import { useSellModal } from "./hooks/useSellModal";

export const OptionsTradingContent = () => {
  const [sellModalOpen] = useSellModal();

  return (
    <section className="col-start-1 col-end-17 -mt-16">
      <Tutorial />

      <AssetPriceInfo />

      <div className="relative border-2 border-black">
        <ExpiryDatePicker />
        <Filters />
        <OptionsTable />
      </div>

      <Purchase />

      <AnimatePresence mode="wait">
        {sellModalOpen && <SellOptionModal />}
      </AnimatePresence>
    </section>
  );
};
