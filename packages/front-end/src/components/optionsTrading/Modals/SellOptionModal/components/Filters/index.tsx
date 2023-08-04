import { CollateralString } from "./components/CollateralString";
import { CollateralTypeSlider } from "./components/CollateralTypeSlider";
import { FullCollateral } from "./components/FullCollateral";
import { Multiplier } from "./components/Multiplier";
import { RiskFactor } from "./components/RiskFactor";

export const Filters = () => {
  return (
    <div className="flex flex-col w-4/5 xl:w-3/5 mx-auto pt-4 select-none">
      <p className="leading-6 border-gray-600 border-b">{`Collateral Preferences`}</p>

      <div className="flex items-center justify-evenly">
        <CollateralTypeSlider />
        <Multiplier />
        <RiskFactor />
      </div>

      <FullCollateral />

      <CollateralString />
    </div>
  );
};
