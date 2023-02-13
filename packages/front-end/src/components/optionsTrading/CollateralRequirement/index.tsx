import { useEffect, useState } from "react";
import NumberFormat from "react-number-format";
import { TextInput } from "../../shared/TextInput";
import useOraclePrice from "../../../hooks/useOraclePrice";
import useMarginRequirement from "../../../hooks/useMarginRequirement";
import { tFormatUSDC, toOpyn } from "../../../utils/conversion-helper";
import { ETHNetwork } from "../../../types";
import addresses from "../../../contracts.json";
import { getNetwork } from "@wagmi/core";
import { BigNumber } from "ethers";
import { SelectedOption } from "../../../state/types";

const CollateralRequirement = ({
  selectedOption,
  strike,
  expiry,
  isPut,
  onChange,
}: {
  selectedOption: SelectedOption;
  strike: number;
  expiry: Date;
  isPut: boolean;
  onChange: (value: string) => void;
}) => {
  // Global state
  const { chain } = getNetwork();
  const network = chain?.network as ETHNetwork;

  // Addresses
  const underlying = addresses[network].WETH;

  // Hooks
  const [getMarginRequirement] = useMarginRequirement();
  const [getOraclePrice] = useOraclePrice();

  // Internal state
  const [margin, setMargin] = useState<string | null>(null);
  const [userInputCollateral, setUserInputCollateral] = useState<string>("");

  // Props adapted
  const expiryTimestamp = (expiry.getTime() / 1000).toFixed(0);

  // Setters
  const handleCollateralChange = (value: string) => {
    setUserInputCollateral(value);
    onChange(value);
  };

  useEffect(() => {
    const fetchMargin = async () => {
      const underlyingPrice = await getOraclePrice(underlying);

      const marginRequirement = await getMarginRequirement(
        "100000000", // TODO - this is hardcoded for now, use the user input amount
        toOpyn(strike.toString()).toString(), // TODO - pass as BigInt ?
        (underlyingPrice as BigNumber).toString(), // TODO - pass as BigInt ?
        expiryTimestamp,
        isPut
      );

      setMargin(marginRequirement as string);
    };

    fetchMargin().catch(console.log);
  }, [
    selectedOption,
    expiryTimestamp,
    isPut,
    strike,
    underlying,
    getMarginRequirement,
    getOraclePrice,
  ]);

  return (
    <div className="w-full p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-parabole mr-2">Collateral:</h4>
        {selectedOption && <p className="pb-1">USDC</p>}
      </div>
      <div className="my-5">
        <div className="flex flex-row justify-between">
          <p>Required:</p>
          <NumberFormat
            value={margin ? tFormatUSDC(BigNumber.from(margin)) : 0}
            displayType={"text"}
            decimalScale={2}
            renderText={(value) => value}
          />
        </div>
        <div className="flex flex-row justify-between">
          <p>Recommended:</p>
          <NumberFormat
            value={
              margin
                ? tFormatUSDC(
                    BigNumber.from(margin).mul("1500000").div("1000000") // 1.5x recommended
                  )
                : 0
            }
            displayType={"text"}
            decimalScale={2}
            renderText={(value) => value}
          />
        </div>
      </div>
      <div className={"w-full mt-2"}>
        <TextInput
          value={userInputCollateral}
          setValue={handleCollateralChange}
          className="text-right w-full h-8"
          iconLeft={
            <div className="px-2 flex items-center h-full">
              <p className="text-gray-600">USDC</p>
            </div>
          }
          numericOnly
          maxNumDecimals={2}
        />
      </div>
    </div>
  );
};

export default CollateralRequirement;
