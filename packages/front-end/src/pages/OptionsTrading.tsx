import React from "react";
import { CustomOptionOrder } from "../components/optionsTrading/CustomOptionOrder";
import { OptionsTable } from "../components/optionsTrading/OptionsTable";
import { Purchase } from "../components/optionsTrading/Purchase";
import { Card } from "../components/shared/Card";
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
      <div className="col-start-1 col-end-17">
        <Card filledHeader headerHeight={60}>
          <div className="flex justify-between">
            <h4 className="text-white p-4">Ethereum.option</h4>
          </div>
          <div className="flex grow">
            <div className="bg-white border-black border-2 p-4 mr-[-2px]">
              <CustomOptionOrder />
            </div>
            <div className="bg-white border-black border-2 pt-4 grow mr-[-2px]">
              <OptionsTable />
            </div>
            <div className="bg-white border-black border-2 p-4 grow">
              <Purchase />
            </div>
          </div>
        </Card>
      </div>
    </OptionsTradingProvider>
  );
};
