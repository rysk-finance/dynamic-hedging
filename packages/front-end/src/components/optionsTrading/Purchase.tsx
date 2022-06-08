import { BigNumber } from "@ethersproject/bignumber";
import { ethers } from "ethers";
import React, { useState } from "react";
import ERC20ABI from "../../abis/erc20.json";
import { useWalletContext } from "../../App";
import OptionHandlerABI from "../../artifacts/contracts/OptionHandler.sol/OptionHandler.json";
import OptionRegistryABI from "../../artifacts/contracts/OptionRegistry.sol/OptionRegistry.json";
import {
  BIG_NUMBER_DECIMALS,
  CHAINID,
  MAX_UINT_256,
  USDC_ADDRESS,
  WETH_ADDRESS,
  ZERO_ADDRESS,
} from "../../config/constants";
import addresses from "../../contracts.json";
import { useContract } from "../../hooks/useContract";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { Option, OptionsTradingActionType } from "../../state/types";
import { OptionSeries } from "../../types";
import { Button } from "../shared/Button";
import { TextInput } from "../shared/TextInput";

const DUMMY_OPTION_SERIES: OptionSeries = {
  strike: BigNumber.from("2000").mul(BIG_NUMBER_DECIMALS.RYSK),
  strikeAsset: USDC_ADDRESS[CHAINID.ETH_MAINNET],
  collateral: USDC_ADDRESS[CHAINID.ETH_MAINNET],
  underlying: WETH_ADDRESS[CHAINID.ETH_MAINNET],
  expiration: "1657267200",
  isPut: false,
};

export const Purchase: React.FC = () => {
  const {
    state: { selectedOption },
    dispatch,
  } = useOptionsTradingContext();

  const { account } = useWalletContext();

  const [optionRegistryContract, optionRegistryContractCall] = useContract({
    address: addresses.localhost.OpynOptionRegistry,
    ABI: OptionRegistryABI.abi,
    readOnly: false,
  });

  const [optionHandlerContract, optionHandlerContractCall] = useContract({
    address: addresses.localhost.optionHandler,
    ABI: OptionHandlerABI.abi,
    readOnly: false,
  });

  const [usdcContract, usdcContractCall] = useContract({
    address: USDC_ADDRESS[CHAINID.ETH_MAINNET],
    ABI: ERC20ABI,
    readOnly: false,
  });

  const setSelectedOption = (option: Option | null) => {
    dispatch({ type: OptionsTradingActionType.SET_SELECTED_OPTION, option });
  };

  const [uiOrderSize, setUIOrderSize] = useState("");

  const buyIsDisabled = !uiOrderSize;

  const handleBuy = async () => {
    if (
      optionRegistryContract &&
      optionHandlerContract &&
      usdcContract &&
      account
    ) {
      try {
        const seriesAddress = await optionRegistryContract.getSeries({
          ...DUMMY_OPTION_SERIES,
          // We create option series using e18, but when our contracts interact with
          // Opyn, this gets converted to e8, so we need to use e8 when checking
          // otokens.
          strike: DUMMY_OPTION_SERIES.strike.div(
            BIG_NUMBER_DECIMALS.RYSK.div(BIG_NUMBER_DECIMALS.OPYN)
          ),
        });
        // Series hasn't been created yet
        if (seriesAddress === ZERO_ADDRESS) {
          await usdcContractCall({
            method: usdcContract.approve,
            args: [
              addresses.localhost.optionHandler,
              ethers.BigNumber.from(MAX_UINT_256),
            ],
            successMessage: "✅ Approval successful",
          });
          await optionHandlerContractCall({
            method: optionHandlerContract.issueAndWriteOption,
            args: [
              DUMMY_OPTION_SERIES,
              BIG_NUMBER_DECIMALS.RYSK.mul(BigNumber.from(uiOrderSize)),
            ],
          });
        } else {
          await usdcContractCall({
            method: usdcContract.approve,
            args: [
              addresses.localhost.optionHandler,
              ethers.BigNumber.from(MAX_UINT_256),
            ],
            successMessage: "✅ Approval successful",
          });

          await optionHandlerContractCall({
            method: optionHandlerContract.writeOption,
            args: [
              seriesAddress,
              BIG_NUMBER_DECIMALS.RYSK.mul(BigNumber.from(uiOrderSize)),
            ],
          });
        }
      } catch (err) {
        console.log(err);
      }
    }
  };

  return (
    <div>
      {selectedOption ? (
        <>
          <div className="w-full flex justify-between relative">
            <div className="w-1/2 border-r-2 border-black">
              <div className="w-full p-4">
                <div className="flex items-center">
                  <h4 className="font-parabole mr-2 pb-2">Option:</h4>
                  {selectedOption && (
                    <p className="pb-1">{selectedOption.type}</p>
                  )}
                </div>
                <p>Strike: {selectedOption.strike}</p>
                <p>IV: {selectedOption.IV}</p>
                <p>Delta: {selectedOption.delta}</p>
                <p>Price: {selectedOption.price}</p>
              </div>
              <div className="w-full ">
                <TextInput
                  value={uiOrderSize}
                  setValue={setUIOrderSize}
                  className="text-right border-x-0 w-full"
                  iconLeft={
                    <div className="px-2 flex items-center h-full">
                      <p className="text-gray-600">Shares</p>
                    </div>
                  }
                  numericOnly
                  maxNumDecimals={2}
                />
              </div>
              <div className="w-full">
                <div className="w-full -mb-1">
                  <div className="w-full p-4 flex items-center">
                    <h4 className="font-parabole mr-2 pb-1">Total price:</h4>
                    {uiOrderSize && (
                      <p>{Number(uiOrderSize) * selectedOption.price} USDC</p>
                    )}
                  </div>
                </div>
              </div>
              <Button
                disabled={buyIsDisabled}
                className={`w-full border-b-0 border-x-0 !py-4 !bg-black text-white ${
                  buyIsDisabled ? "!bg-gray-300" : ""
                }`}
                onClick={handleBuy}
              >
                Buy
              </Button>
            </div>
          </div>
        </>
      ) : (
        <p className="p-4">Select an option first</p>
      )}
    </div>
  );
};
