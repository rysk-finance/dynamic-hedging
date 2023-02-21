import { OptionsTable } from "./OptionsTable";
import { Purchase } from "./Purchase";
import { ExpiryDatePicker } from "./ExpiryDatePicker";
import { Filters } from "./Filters/Filters";
import { AssetPriceInfo } from "./AssetPriceInfo";

export const OptionsTradingContent = () => {
  return (
    <section className="col-start-1 col-end-17 -mt-16">
      <AssetPriceInfo />

      <div className="relative border-2 border-black">
        <ExpiryDatePicker />
        <Filters />
        <OptionsTable />
      </div>

      <Purchase />
    </section>
  );
};
