import React from "react";
import { CustomOptionOrder } from "../components/optionsTrading/CustomOptionOrder";
import { OptionsTable } from "../components/optionsTrading/OptionsTable";
import { Purchase } from "../components/optionsTrading/Purchase";
import { Card } from "../components/shared/Card";
import { ETHPriceIndicator } from "../components/shared/ETHPriceIndicator";
import { useGlobalContext } from "../state/GlobalContext";
import { OptionsTradingProvider } from "../state/OptionsTradingContext";

export const OptionsTrading = () => {
  const {
    state: { ethPriceUpdateTime },
  } = useGlobalContext();
  return (
    <OptionsTradingProvider>
      <div className="col-start-1 col-end-17 mb-16 flex justify-between">
        <h3>Trade Options</h3>
        <div className="flex items-start"></div>
      </div>
      <div className="col-start-1 col-end-17">
        <Card filledHeader headerHeight={50}>
          <div className="flex justify-between mt-[-5px]">
            <p className="text-white p-4">Ethereum.option</p>
          </div>
          <div className="flex justify-stretch items-stretch">
            <div className="px-6 py-4 border-r-2 border-black">
              <img src="/icons/ethereum.svg" />
            </div>
            <div className="flex items-center justify-between grow px-4">
              <div className="flex flex-col justify-around">
                <h4>Ethereum</h4>
                <p className="text-gray-600 text-xs">
                  Late Update: {ethPriceUpdateTime?.toLocaleTimeString("en-US")}
                </p>
              </div>
              <ETHPriceIndicator />
            </div>
          </div>
          <div className="flex grow">
            <div className="bg-white border-black border-2 p-4 mr-[-2px]">
              <CustomOptionOrder />
            </div>
            <div className="bg-white border-black border-2 grow mr-[-2px]">
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
