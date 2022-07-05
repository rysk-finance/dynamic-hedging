import { Button } from "../shared/Button"
import React, { useState } from "react";
import { useContract } from "../../hooks/useContract";
import OptionRegistryABI from "../../abis/OptionRegistry.json";
import OptionHandlerABI from "../../abis/OptionHandler.json";
import { useWalletContext } from "../../App";
import { TextInput } from "../shared/TextInput";
import { BIG_NUMBER_DECIMALS } from "../../config/constants";
import { BigNumber } from "ethers";

export const BuyBack: React.FC<{selectedOption: string}> = ({selectedOption}) => {


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
    // setIsApproved(false);
    setUIOrderSize(value);
  };


  const handleBuyBack = async () => {
    if (
      optionRegistryContract &&
      optionHandlerContract &&
      account
    ) {
      try {

        // const seriesInfo = await optionRegistryContract.getSeriesInfo(selectedOption)
        // console.log(seriesInfo)

        const amount = BIG_NUMBER_DECIMALS.OPYN.mul(
          BigNumber.from(uiOrderSize)
        );

        console.log(amount.toString())

        await optionHandlerContractCall({
          method: optionHandlerContract.buybackOption,
          args: [selectedOption, amount],
          onComplete: () => {
            setUIOrderSize("");
            console.log('completed')
            // setIsApproved(false);
          },
          onFail: () => {
            // setIsApproved(false);
          },
        });

      } catch (err) {
        console.log(err);
      }
    }
  }

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
        {/* <Button
          className={`w-full border-b-0 border-x-0 !py-4 text-white ${
            approveIsDisabled ? "!bg-gray-300 " : "!bg-black"
          }`}
          onClick={handleApproveSpend}
        >
          {`${isApproved ? "Approved ✅" : "Approve"}`}
        </Button> */}
        <Button
          // disabled={buyIsDisabled}
          // className={`w-full border-b-0 border-x-0 !py-4 text-white ${
          //   buyIsDisabled ? "!bg-gray-300" : "!bg-black"
          // }`}
          className="w-full mt-4"
          onClick={handleBuyBack}
        >
          Sell
        </Button>
      </div>


    </div>
  )

}