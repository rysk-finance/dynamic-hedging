import React, { useState } from "react";
import { Button } from "../components/shared/Button";
import { Card } from "../components/shared/Card";
import { RadioButtonSlider } from "../components/shared/RadioButtonSlider";
import { Option } from "../types";

enum OptionState {
  OPEN = "Open",
  EXPIRED = "Expired",
}

const OPTIONS_BUTTONS: Option<OptionState>[] = [
  {
    key: OptionState.OPEN,
    label: OptionState.OPEN,
    value: OptionState.OPEN,
  },
  {
    key: OptionState.EXPIRED,
    label: OptionState.EXPIRED,
    value: OptionState.EXPIRED,
  },
];

export const Dashboard = () => {
  const [listedOptionState, setListedOptionState] = useState(OptionState.OPEN);

  return (
    <div className="col-start-1 col-end-17">
      <div className="w-full mb-24">
        <h2 className="mb-4">Vaults</h2>
        <div className="mb-24">
          <Card tabHeight={35} tabWidth={150} tabPunchColor="red-500">
            <div className="bg-black p-4 rounded-tr-lg mt-[-1px]">
              <h3 className="text-white font-parabole">Dynamic Hedging</h3>
            </div>
            <div className="pb-8 py-12 px-8 flex flex-col lg:flex-row h-full">
              <div className="flex h-full w-full lg:w-[70%] justify-around">
                <div className="flex flex-col items-center justify-center h-full mb-8 lg:mb-0">
                  <h3 className="mb-2">$1000</h3>
                  <h4 className="mb-2">Position</h4>
                  <a href="#" className="underline">
                    Learn more
                  </a>
                </div>
                <div className="flex flex-col items-center justify-center h-full">
                  <h3 className="mb-2">+$300</h3>
                  <h4 className="mb-2">PNL</h4>
                  <a href="#" className="underline">
                    Learn more
                  </a>
                </div>
                <div className="flex flex-col items-center justify-center h-full">
                  <h3 className="mb-2">30%</h3>
                  <h4 className="mb-2">APY</h4>
                  <a href="#" className="underline">
                    Learn more
                  </a>
                </div>
              </div>
              <div className="flex flex-col w-full lg:w-[30%] lg:w-full h-full justify-around items-center">
                <Button className="w-full mb-8">Deposit</Button>
                <Button className="w-full">Withdraw</Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="w-full">
          <h2 className="mb-4">Options</h2>
          <Card tabHeight={35} tabWidth={150} tabPunchColor="red-500">
            <div className="border-y-2 border-black p-4 rounded-tr-lg mt-[-1px]">
              <RadioButtonSlider
                options={OPTIONS_BUTTONS}
                selected={listedOptionState}
                setSelected={setListedOptionState}
              />
            </div>
            <div className="pb-8 py-12 px-8 flex flex-col lg:flex-row h-full"></div>
          </Card>
        </div>
      </div>
    </div>
  );
};
