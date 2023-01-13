import { Button } from "../shared/Button";
import { useState } from "react";
import { useContract } from "../../hooks/useContract";
import OptionRegistryABI from "../../abis/OptionRegistry.json";
import OptionHandlerABI from "../../abis/OptionHandler.json";
import { useWalletContext } from "../../App";
import { TextInput } from "../shared/TextInput";
import { BIG_NUMBER_DECIMALS } from "../../config/constants";
import { BigNumber } from "ethers";

interface BuyBackProps {
  selectedOption: string;
}

export const BuyBack = ({ selectedOption }: BuyBackProps) => {
  const { account } = useWalletContext();

  const [uiOrderSize, setUIOrderSize] = useState("");

  // Contracts
  const [optionRegistryContract, optionRegistryContractCall] = useContract({
    contract: "OpynOptionRegistry",
    ABI: OptionRegistryABI,
    readOnly: false,
  });

  const [optionHandlerContract, optionHandlerContractCall] = useContract({
    contract: "optionHandler",
    ABI: OptionHandlerABI,
    readOnly: false,
  });

  const handleInputChange = (value: string) => {
    setUIOrderSize(value);
  };

  const handleBuyBack = async () => {
    if (optionRegistryContract && optionHandlerContract && account) {
      try {
        const amount = BIG_NUMBER_DECIMALS.OPYN.mul(
          BigNumber.from(uiOrderSize)
        );

        console.log(amount.toString());

        await optionHandlerContractCall({
          method: optionHandlerContract.buybackOption,
          args: [selectedOption, amount],
          onSubmit: () => {
            setUIOrderSize("");
            console.log("completed");
          },
        });
      } catch (err) {
        console.log(err);
      }
    }
  };

  return (
    <div>
      <TextInput
        value={uiOrderSize}
        setValue={handleInputChange}
        className="text-right border-x-0 w-full"
        iconLeft={
          <div className="px-2 flex items-center h-full">
            <p className="text-gray-600">amount to sell</p>
          </div>
        }
        numericOnly
        maxNumDecimals={2}
      />

      <div className="flex">
        <Button className="w-full mt-4" onClick={handleBuyBack}>
          Sell
        </Button>
      </div>
    </div>
  );
};
