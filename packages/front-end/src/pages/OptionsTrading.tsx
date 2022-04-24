import React from "react";
import { CustomOptionOrder } from "../components/optionsTrading/CustomOptionOrder";
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
      <div className="col-start-1 col-end-6 p-4">
        <div className="bg-white border-black border-2 p-2">
          <CustomOptionOrder />
        </div>
      </div>
      <div className="col-start-6 col-end-12 p-4">
        <div className="bg-white border-black border-2"></div>
      </div>
      <div className="col-start-12 col-end-17 p-4">
        <div className="bg-white border-black border-2"></div>
      </div>
    </OptionsTradingProvider>
  );
};
