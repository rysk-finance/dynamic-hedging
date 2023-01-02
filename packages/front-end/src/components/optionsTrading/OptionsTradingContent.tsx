import { useGlobalContext } from "../../state/GlobalContext";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { ETHPriceIndicator } from "../shared/ETHPriceIndicator";
import { OptionsTable } from "./OptionsTable";
import { Purchase } from "./Purchase";
import { ExpiryDatePicker } from "./ExpiryDatePicker";

export const OptionsTradingContent = () => {
  const {
    state: { ethPriceUpdateTime },
  } = useGlobalContext();

  return (
    <>
      <div className="col-start-1 col-end-17 -mt-16">
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
                Latest Update: {ethPriceUpdateTime?.toLocaleTimeString("en-US")}
              </p>
            </div>
            <ETHPriceIndicator />
          </div>
        </div>
        <div className="border-x-2 border-black">
          <div className="w-full">
            <div className="">
              <ExpiryDatePicker />
            </div>
          </div>
          <div className="flex grow items-stretch">
            <div className="grow flex-col rounded-br-lg">
              <div className="grow border-black rounded-br-lg">
                <OptionsTable />
              </div>
            </div>
          </div>
        </div>
        <div className="grow rounded-br-lg flex flex-col">
          {/** TODO move this into Purchase component */}
          {/*<div className="bg-black p-2 text-white flex justify-between">*/}
          {/*  {selectedOption && (*/}
          {/*    <button*/}
          {/*      className="text-xl top-4 right-4 text-white"*/}
          {/*      onClick={() => setSelectedOption(null)}*/}
          {/*    >*/}
          {/*      ✕*/}
          {/*    </button>*/}
          {/*  )}*/}
          {/*</div>*/}
          <div>
            <Purchase />
          </div>
        </div>
      </div>
    </>
  );
};
