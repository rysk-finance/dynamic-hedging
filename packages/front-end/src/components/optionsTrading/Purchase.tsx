import { BigNumber } from "@ethersproject/bignumber";
import dayjs from "dayjs";
import { ethers } from "ethers";
import { useState } from "react";
import NumberFormat from "react-number-format";
import { toast } from "react-toastify";
import { useAccount, useNetwork } from "wagmi";

import ERC20ABI from "../../abis/erc20.json";
import OptionExchangeABI from "../../abis/OptionExchange.json";
import OptionRegistryABI from "../../abis/OptionRegistry.json";
import {
  BIG_NUMBER_DECIMALS,
  MAX_UINT_256,
  ZERO_ADDRESS,
} from "../../config/constants";
import addresses from "../../contracts.json";
import { useContract } from "../../hooks/useContract";
import { useGlobalContext } from "../../state/GlobalContext";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { ContractAddresses, ETHNetwork } from "../../types";
import { toUSDC, toWei } from "../../utils/conversion-helper";
import { Button } from "../shared/Button";
import { TextInput } from "../shared/TextInput";

const formatOptionDate = (date: number | null) => {
  if (date) {
    return dayjs.unix(date).format("DDMMMYY").toUpperCase();
  }
};

export const Purchase = () => {
  const { address } = useAccount();
  const { chain } = useNetwork();

  const network = chain?.network as ETHNetwork;
  const typedAddresses = addresses as Record<ETHNetwork, ContractAddresses>;

  // Context state
  const {
    state: { settings },
  } = useGlobalContext();

  const {
    state: { selectedOption, expiryDate },
  } = useOptionsTradingContext();

  // Local state
  const [uiOrderSize, setUIOrderSize] = useState("");
  const [isApproved, setIsApproved] = useState(false);

  // Contracts
  const [optionRegistryContract] = useContract({
    contract: "OpynOptionRegistry",
    ABI: OptionRegistryABI,
    readOnly: false,
  });

  const [optionExchangeContract] = useContract({
    contract: "optionExchange",
    ABI: OptionExchangeABI,
    readOnly: false,
  });

  const [usdcContract, usdcContractCall] = useContract({
    contract: "USDC",
    ABI: ERC20ABI,
    readOnly: false,
  });

  const handleInputChange = (value: string) => {
    setIsApproved(false);
    setUIOrderSize(value);
  };

  const handleApproveSpend = async () => {
    if (usdcContract && strikeOptions && callOrPut && bidOrAsk) {
      const amount = toUSDC(
        (
          strikeOptions[callOrPut][bidOrAsk].quote * Number(uiOrderSize)
        ).toString()
      );

      const approvedAmount = (await usdcContract.allowance(
        address,
        addresses[network].optionExchange
      )) as BigNumber;

      try {
        if (
          !settings.optionsTradingUnlimitedApproval ||
          approvedAmount.lt(amount)
        ) {
          await usdcContractCall({
            method: usdcContract?.approve,
            args: [
              addresses[network].optionExchange,
              settings.optionsTradingUnlimitedApproval
                ? ethers.BigNumber.from(MAX_UINT_256)
                : amount,
            ],
            submitMessage: "✅ Approval successful",
          });
        } else {
          toast("✅ Your transaction is already approved");
        }
        setIsApproved(true);
      } catch {
        toast("❌ There was an error approving your transaction.");
      }
    }
  };

  const handleBuy = async () => {
    if (
      optionRegistryContract &&
      optionExchangeContract &&
      usdcContract &&
      address &&
      expiryDate &&
      selectedOption &&
      chain
    ) {
      try {
        const amount = BIG_NUMBER_DECIMALS.RYSK.mul(
          BigNumber.from(uiOrderSize)
        );
        const proposedSeries = {
          expiration: expiryDate,
          strike: toWei(selectedOption.strikeOptions.strike.toString()),
          isPut: selectedOption.callOrPut == "put",
          strikeAsset: typedAddresses[network].USDC,
          underlying: typedAddresses[network].WETH,
          collateral: typedAddresses[network].USDC,
        };

        optionExchangeContract?.operate(
          [
            {
              operation: 1,
              operationQueue: [
                {
                  actionType: 0,
                  owner: ZERO_ADDRESS,
                  secondAddress: ZERO_ADDRESS,
                  asset: ZERO_ADDRESS,
                  vaultId: 0,
                  amount: 0,
                  optionSeries: proposedSeries,
                  index: 0,
                  data: "0x",
                },
                {
                  actionType: 1,
                  owner: ZERO_ADDRESS,
                  secondAddress: address,
                  asset: ZERO_ADDRESS,
                  vaultId: 0,
                  amount: amount,
                  optionSeries: proposedSeries,
                  index: 0,
                  data: "0x",
                },
              ],
            },
          ],
          { gasLimit: 2500000 }
        );
      } catch (err) {
        console.log(err);
      }
    }
  };

  const approveIsDisabled = !uiOrderSize || isApproved;
  const buyIsDisabled = !uiOrderSize || !isApproved;

  const callOrPut = selectedOption?.callOrPut;
  const bidOrAsk = selectedOption?.bidOrAsk;
  const strikeOptions = selectedOption?.strikeOptions;

  return (
    <div>
      {strikeOptions && callOrPut && bidOrAsk ? (
        <>
          <div className="w-full flex justify-between relative">
            <div className="w-1/2 border-r-2 border-black">
              <div className="w-full p-4">
                <div className="flex items-center">
                  <h4 className="font-parabole mr-2 pb-2">Option:</h4>
                  {selectedOption && (
                    <p className="pb-1">{callOrPut.toUpperCase()}</p>
                  )}
                </div>
                <p>Strike: {strikeOptions.strike}</p>
                <p>
                  IV:{" "}
                  <NumberFormat
                    value={strikeOptions[callOrPut][bidOrAsk].IV}
                    displayType={"text"}
                    decimalScale={2}
                    renderText={(value) => value}
                    suffix={"%"}
                  />
                </p>
                <p>
                  Delta:{" "}
                  <NumberFormat
                    value={strikeOptions[callOrPut].delta}
                    displayType={"text"}
                    decimalScale={2}
                    renderText={(value) => value}
                  />
                </p>
                <p>
                  Price:{" "}
                  <NumberFormat
                    value={strikeOptions[callOrPut][bidOrAsk].quote}
                    displayType={"text"}
                    decimalScale={2}
                    renderText={(value) => value}
                    prefix={"$"}
                  />
                </p>
              </div>
              <div className="w-full ">
                <TextInput
                  value={uiOrderSize}
                  setValue={handleInputChange}
                  className="text-right border-r-0 w-full"
                  iconLeft={
                    <div className="px-2 flex items-center h-full">
                      <p className="text-gray-600">Amount</p>
                    </div>
                  }
                  numericOnly
                  maxNumDecimals={2}
                />
              </div>
            </div>
            <div className="w-1/2 flex flex-col justify-between">
              <div className="w-full">
                <div className="w-full -mb-1">
                  <div className="w-full p-4 flex flex-col">
                    <h5 className={`mb-10 tracking-tight`}>
                      ETH-{formatOptionDate(expiryDate)}-{strikeOptions?.strike}
                      -{selectedOption.callOrPut === "put" ? "P" : "C"}
                    </h5>

                    {uiOrderSize && (
                      <>
                        <h4 className="font-parabole mr-2">Total price:</h4>
                        <p>
                          {Number(uiOrderSize) *
                            strikeOptions[callOrPut][bidOrAsk].quote}{" "}
                          USDC
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex">
                <Button
                  className={`w-full border-l-0 !py-2 text-white ${
                    approveIsDisabled ? "!bg-gray-300 " : "!bg-black"
                  }`}
                  onClick={handleApproveSpend}
                >
                  {`${isApproved ? "Approved ✅" : "Approve"}`}
                </Button>
                <Button
                  disabled={buyIsDisabled}
                  className={`w-full border-l-0 !py-2 text-white ${
                    buyIsDisabled ? "!bg-gray-300" : "!bg-black"
                  }`}
                  onClick={handleBuy}
                >
                  Buy
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="p-4">Select an option first</p>
      )}
    </div>
  );
};
