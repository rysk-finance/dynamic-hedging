import React from "react";
import { CustomOptionOrder } from "../components/optionsTrading/CustomOptionOrder";
import { OptionsChart } from "../components/optionsTrading/OptionsChart";
import { Purchase } from "../components/optionsTrading/Purchase";
import { ETHPriceIndicator } from "../components/shared/ETHPriceIndicator";
import { OptionsTradingProvider } from "../state/OptionsTradingContext";

export const OptionsTrading = () => {
  return (
    <OptionsTradingProvider>
      <div className="col-start-1 col-end-17 mb-16 flex justify-between">
        <h3>Trade Options</h3>
        <div className="flex items-start">
          <ETHPriceIndicator />
        </div>
      </div>
      <div className="col-start-1 col-end-6 pr-4 py-4">
        <div className="bg-white border-black border-2 p-4">
          <CustomOptionOrder />
        </div>
      </div>
      <div className="col-start-6 col-end-12 p-4">
        <div className="bg-white border-black border-2 pt-4">
          <OptionsChart />
        </div>
      </div>
      <div className="col-start-12 col-end-17 pl-4 pl-4 py-4">
        <div className="bg-white border-black border-2 p-4">
          <Purchase />
        </div>
      </div>
    </OptionsTradingProvider>
  );
};
