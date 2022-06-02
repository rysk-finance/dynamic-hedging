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
        <Card headerHeight={50} headerContent="ETH.option">
          <div className="flex justify-stretch items-stretch">
            <div className="px-6 py-4 border-r-2 border-black">
              <img src="/icons/ethereum.svg" />
            </div>
            <div className="flex items-center justify-between grow px-4">
              <div className="flex flex-col justify-around">
                <h4>
                  <b>Ether</b>
                </h4>
                <p className="text-gray-600 text-xs">
                  Late Update: {ethPriceUpdateTime?.toLocaleTimeString("en-US")}
                </p>
              </div>
              <ETHPriceIndicator />
            </div>
          </div>
          <div className="flex grow items-stretch">
            <div className="bg-bone rounded-bl-lg flex flex-col">
              <div className="bg-black p-2 text-white border-r-2 border-white">
                <p>Custom Option</p>
              </div>
              <div className="grow border-r-2 border-black rounded-bl-lg grow">
                <CustomOptionOrder />
              </div>
            </div>
            <div className="grow flex-col rounded-br-lg">
              <div className="bg-black p-2 text-white ">
                <p>Options</p>
              </div>
              <div className="grow border-black rounded-br-lg">
                <OptionsTable />
              </div>
            </div>
            {/* <div className="bg-white grow rounded-br-lg flex flex-col">
              <div className="bg-black p-2 text-white">
                <p>Complete order</p>
              </div>
              <div className="grow border-r-2 border-b-2 border-black rounded-br-lg">
                <div className="grow">
                  <Purchase />
                </div>
              </div>
            </div> */}
          </div>
        </Card>
      </div>
    </OptionsTradingProvider>
  );
};
