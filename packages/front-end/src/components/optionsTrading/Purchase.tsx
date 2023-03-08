import { BigNumber } from "@ethersproject/bignumber";
import { captureException } from "@sentry/react";
import dayjs from "dayjs";
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import NumberFormat from "react-number-format";
import { toast } from "react-toastify";
import { useAccount, useNetwork } from "wagmi";

import { getContractAddress } from "src/utils/helpers";
import ERC20ABI from "../../abis/erc20.json";
import OptionExchangeABI from "../../abis/OptionExchange.json";
import OptionRegistryABI from "../../abis/OptionRegistry.json";
import {
  BIG_NUMBER_DECIMALS,
  MAX_UINT_256,
  ZERO_ADDRESS,
} from "../../config/constants";
import useApproveExchange from "../../hooks/useApproveExchange";
import useApproveTransfer from "../../hooks/useApproveTransfer";
import { useContract } from "../../hooks/useContract";
import useOToken from "../../hooks/useOToken";
import useSellOperate from "../../hooks/useSellOperate";
import useTenderlySimulator from "../../hooks/useTenderlySimulator";
import { useGlobalContext } from "../../state/GlobalContext";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { toOpyn, toUSDC, toWei } from "../../utils/conversion-helper";
import { Button } from "../shared/Button";
import { TextInput } from "../shared/TextInput";
import CollateralRequirement from "./CollateralRequirement";
import { toTwoDecimalPlaces } from "src/utils/rounding";

const formatOptionDate = (date: number | null) => {
  if (date) {
    return dayjs.unix(date).format("DDMMMYY").toUpperCase();
  }
};

export const Purchase = () => {
  const { address } = useAccount();
  const { chain } = useNetwork();

  const [approveExchange, exchangeIsApproved] = useApproveExchange();
  const [
    approveUSDCTransfer,
    allowanceUSDC,
    setApprovalUSDCAmount,
    isUSDCApproved,
    approveUSDCStatus,
  ] = useApproveTransfer();
  const [
    sellOperate,
    setMarginUSDCAmount,
    setSellAmount,
    setOptionSeries,
    setOToken,
  ] = useSellOperate();

  const [getOToken] = useOToken();

  const [simulateOperation, simulateError, simulateIsLoading] =
    useTenderlySimulator({
      to: getContractAddress("optionExchange"),
    });

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

  // note - to avoid using state i'm saving this in the hook for now
  useEffect(() => {
    if (selectedOption && expiryDate) {
      const optionDetails = {
        expiration: BigNumber.from(expiryDate),
        strike: toWei(selectedOption.strikeOptions.strike.toString()),
        isPut: selectedOption.callOrPut === "put",
      };

      const retrieveOtoken = async () => {
        const oToken = await getOToken(
          optionDetails.expiration.toString(),
          optionDetails.strike,
          optionDetails.isPut
        );
        setOToken(oToken);
      };

      setOptionSeries(optionDetails);
      retrieveOtoken();
    }
  }, [selectedOption, expiryDate]);

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

  // note - need to let hook know about amount update for now
  const handleInputChange = (value: string) => {
    setIsApproved(false);
    setUIOrderSize(value);
    setSellAmount(toOpyn(value));
  };

  // note - need to let hooks know about state update for now
  const handleCollateralChange = (value: string) => {
    setApprovalUSDCAmount(toUSDC(value));
    setMarginUSDCAmount(toUSDC(value));
  };

  const handleApprovePremium = async () => {
    if (usdcContract && strikeOptions && callOrPut && bidOrAsk) {
      const total =
        strikeOptions[callOrPut][bidOrAsk].quote * Number(uiOrderSize);
      const withBuffer = toTwoDecimalPlaces(total * 1.05);
      const amount = toUSDC(String(withBuffer));

      const approvedAmount = (await usdcContract.allowance(
        address,
        getContractAddress("optionExchange")
      )) as BigNumber;

      try {
        if (
          !settings.optionsTradingUnlimitedApproval ||
          approvedAmount.lt(amount)
        ) {
          await usdcContractCall({
            method: usdcContract?.approve,
            args: [
              getContractAddress("optionExchange"),
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
      } catch (error) {
        captureException(error);
        console.error(error);
        toast("❌ There was an error approving your transaction.");
      }
    }
  };

  const handleApproveCollateral = async () => {
    if (approveUSDCTransfer) {
      approveUSDCTransfer();
    }
  };

  const handleSell = async () => {
    sellOperate?.();
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
          isPut: selectedOption.callOrPut === "put",
          strikeAsset: getContractAddress("USDC"),
          underlying: getContractAddress("WETH"),
          collateral: getContractAddress("USDC"),
        };

        const txData = [
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
        ];

        const { data } =
          await optionExchangeContract.populateTransaction.operate(txData);

        if (data) {
          const response = await simulateOperation(data, 0, 0, 0);

          if (response?.simulation.status === true) {
            optionExchangeContract?.operate(txData, {
              gasLimit: String(Math.ceil(response.simulation.gas_used * 1.1)),
            });
          } else {
            toast("❌ Transaction would fail, reach out to the team.");
          }
        }
      } catch (err) {
        console.log(err);
      }
    }
  };

  const approveIsDisabled = !uiOrderSize || isApproved;
  const buyIsDisabled = !uiOrderSize || !isApproved;
  const sellIsDisabled = !uiOrderSize || !isUSDCApproved;

  const callOrPut = selectedOption?.callOrPut;
  const bidOrAsk = selectedOption?.bidOrAsk;
  const strikeOptions = selectedOption?.strikeOptions;

  simulateError && toast(simulateError as string);

  return (
    <div className="grow flex flex-col">
      {strikeOptions && callOrPut && bidOrAsk ? (
        <>
          <div className="w-full flex justify-between relative">
            <div className="w-1/2 border-r-2 border-black">
              <div className="w-full p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-parabole text-xl mr-2 pb-2">Option:</h4>
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
            {bidOrAsk === "bid" && (
              <div className="w-1/2 border-r-2 border-black">
                {selectedOption && expiryDate && (
                  <CollateralRequirement
                    selectedOption={selectedOption}
                    strike={strikeOptions.strike}
                    expiry={expiryDate}
                    isPut={callOrPut === "put"}
                    orderSize={uiOrderSize}
                    onChange={handleCollateralChange}
                  />
                )}
              </div>
            )}
            <div className="w-2/3 flex flex-row justify-between">
              <div className="w-1/2">
                <div className="w-full -mb-1">
                  <div className="w-full p-4 flex flex-col">
                    <h5 className={`mb-10 tracking-tight text-lg`}>
                      ETH-{formatOptionDate(expiryDate)}-{strikeOptions?.strike}
                      -{selectedOption.callOrPut === "put" ? "P" : "C"}
                    </h5>
                    {uiOrderSize && (
                      <>
                        <h4 className="font-parabole text-xl mr-2">
                          Total price:
                        </h4>
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
              <div className="w-2/3 flex flex-col justify-end">
                {/** TODO - missing a condition && of only when user is minting oTokens */}
                {!exchangeIsApproved && approveExchange && (
                  <Button
                    className={"w-full mb-2 !py-2 text-white !bg-black"}
                    onClick={() => approveExchange()}
                  >
                    One Time Exchange Approval
                  </Button>
                )}
                {!isUSDCApproved && (
                  <Button
                    className={"w-full mb-2 !py-2 text-white !bg-black"}
                    onClick={handleApproveCollateral}
                  >
                    {approveUSDCStatus.isSuccess
                      ? "TX Sent ✅"
                      : approveUSDCStatus.isError
                      ? "Error ❌"
                      : approveUSDCStatus.isLoading
                      ? "Loading..."
                      : "Approve Collateral"}
                  </Button>
                )}
                {uiOrderSize && bidOrAsk === "ask" && (
                  <Button
                    className={`w-full mb-2 !py-2 text-white ${
                      approveIsDisabled ? "!bg-gray-300 " : "!bg-black"
                    }`}
                    onClick={handleApprovePremium}
                  >
                    {`${isApproved ? "Approved ✅" : "Approve Premium"}`}
                  </Button>
                )}
                <Button
                  disabled={sellIsDisabled} // TODO - missing a condition for buy
                  className={`w-full !py-2 text-white ${
                    sellIsDisabled ? "!bg-gray-300" : "!bg-black" // TODO - missing a condition for buy
                  }`}
                  onClick={bidOrAsk === "ask" ? handleBuy : handleSell}
                >
                  {simulateIsLoading
                    ? "Simulating..."
                    : bidOrAsk === "ask"
                    ? "Buy"
                    : "Sell"}
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
