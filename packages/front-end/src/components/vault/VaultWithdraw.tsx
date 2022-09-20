import React from "react";
import { BigNumber, ethers } from "ethers";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import ERC20ABI from "../../abis/erc20.json";
import { useWalletContext } from "../../App";
import LPABI from "../../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json";
import {
  BIG_NUMBER_DECIMALS,
  DECIMALS,
  DHV_NAME,
  MAX_UINT_256,
  ZERO_UINT_256,
} from "../../config/constants";
import { useContract } from "../../hooks/useContract";
import { useGlobalContext } from "../../state/GlobalContext";
import { useVaultContext } from "../../state/VaultContext";
import { Currency, WithdrawalReceipt } from "../../types";
import { BigNumberDisplay } from "../BigNumberDisplay";
import { RequiresWalletConnection } from "../RequiresWalletConnection";
import { RyskTooltip } from "../RyskTooltip";
import { Button } from "../shared/Button";
import { TextInput } from "../shared/TextInput";
import { Loader } from "../Loader";
import { useUserPosition } from "../../hooks/useUserPosition";
import ReactSlider from "react-slider";
import { VaultWithdrawBalanceTooltip } from "./VaultWithdrawBalanceTooltip";
import { WITHDRAW_SHARES_EPOCH } from "../../config/messages";
import { PendingWithdrawBreakdown } from "./PendingWithdrawBreakdown";

export const VaultWithdraw = () => {
  const { account, network } = useWalletContext();
  const {
    state: {
      depositEpoch: currentEpoch,
      depositPricePerShare: currentPricePerShare,
    },
  } = useVaultContext();

  const {
    updatePosition,
    positionBreakdown: { unredeemedShares, redeemedShares },
  } = useUserPosition();

  // UI State
  const [inputValue, setInputValue] = useState("");
  const [listeningForInitiation, setListeningForInitiation] = useState(false);
  const [listeningForCompleteWithdraw, setListeningForCompleteWithdraw] =
    useState(false);
  const [withdrawEpochComplete, setWithdrawEpochComplete] = useState(false);
  const [withdrawableUSDC, setWithdrawableUSDC] = useState<BigNumber | null>(
    null
  );
  const [sliderPercentage, setSlidePercentage] = useState(50);

  // Chain state
  const [withdrawReceipt, setWithdrawReceipt] =
    useState<WithdrawalReceipt | null>(null);

  // Contracts
  const [lpContract, lpContractCall] = useContract<{
    WithdrawalEpochExecuted: [];
  }>({
    contract: "liquidityPool",
    ABI: LPABI.abi,
    readOnly: false,
    events: {
      WithdrawalEpochExecuted: () => {
        epochListener();
      },
    },
    isListening: {
      WithdrawalEpochExecuted: true,
    },
  });

  const [usdcContract, usdcContractCall] = useContract({
    contract: "USDC",
    ABI: ERC20ABI,
    readOnly: false,
  });

  const withdrawableDHV =
    redeemedShares && unredeemedShares && redeemedShares?.add(unredeemedShares);

  const getWithdrawalReceipt = useCallback(
    async (address: string) => {
      const withdrawalReceipt: WithdrawalReceipt =
        await lpContract?.withdrawalReceipts(address);
      setWithdrawReceipt(withdrawalReceipt);
      return withdrawalReceipt;
    },
    [lpContract]
  );

  const updateWithdrawState = useCallback(async () => {
    if (account && currentPricePerShare && currentEpoch && lpContract) {
      const receipt = await getWithdrawalReceipt(account);
      setWithdrawReceipt(receipt);
      const isReceipt = receipt.shares._hex !== ZERO_UINT_256;
      if (isReceipt) {
        if (
          currentEpoch.gt(receipt.epoch) &&
          receipt.shares._hex !== ZERO_UINT_256
        ) {
          setWithdrawEpochComplete(true);
          const receiptEpochSharePrice: BigNumber =
            await lpContract.withdrawalEpochPricePerShare(receipt.epoch);
          // e18
          const usdcValue = receipt.shares
            // e36
            .mul(receiptEpochSharePrice)
            // e18
            .div(BIG_NUMBER_DECIMALS.RYSK)
            // e6
            .div(BIG_NUMBER_DECIMALS.RYSK.div(BIG_NUMBER_DECIMALS.USDC));
          setWithdrawableUSDC(usdcValue);
        }
      } else {
        setWithdrawEpochComplete(false);
        setWithdrawReceipt(receipt);
        setWithdrawableUSDC(null);
      }
    }
  }, [
    account,
    currentEpoch,
    currentPricePerShare,
    getWithdrawalReceipt,
    lpContract,
  ]);

  const epochListener = useCallback(async () => {
    updateWithdrawState();
    if (account) {
      updatePosition(account);
    }
  }, [updateWithdrawState, account, updatePosition]);

  useEffect(() => {
    (async () => {
      await updateWithdrawState();
    })();
  }, [updateWithdrawState]);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (withdrawableDHV) {
      // e18
      const bigNumberPercentage = ethers.utils
        .parseUnits(value, DECIMALS.RYSK)
        .mul(BIG_NUMBER_DECIMALS.RYSK)
        .div(withdrawableDHV);
      const percentage = Math.round(
        Number(ethers.utils.formatUnits(bigNumberPercentage, DECIMALS.RYSK)) *
          100
      );
      setSlidePercentage(percentage);
    }
  };

  const handleSliderChange = (value: number) => {
    setSlidePercentage(value);
    if (withdrawableDHV) {
      const inputValue = ethers.utils.formatUnits(
        withdrawableDHV.mul(value).div(100)
      );
      setInputValue(inputValue);
    }
  };

  const handleInitiateWithdraw = async () => {
    if (usdcContract && lpContract && account && network) {
      const amount = ethers.utils.parseUnits(inputValue, DECIMALS.RYSK);
      await lpContractCall({
        method: lpContract.initiateWithdraw,
        args: [amount],
        scaleGasLimit: true,
        methodName: "initiateWithdraw",
        submitMessage: "✅ Withdraw initiation submitted",
        onSubmit: () => {
          setListeningForInitiation(true);
        },
        completeMessage:
          "✅ Your withdraw was initiated. You will be able to complete it when this epoch is executed.",

        onComplete: () => {
          setListeningForInitiation(false);
          if (account) {
            updatePosition(account);
          }
          updateWithdrawState();
          updatePosition(account);
          setInputValue("");
        },
      });
    }
  };

  const handleCompleteWithdraw = async () => {
    if (lpContract) {
      await lpContractCall({
        method: lpContract.completeWithdraw,
        args: [MAX_UINT_256],
        scaleGasLimit: true,
        methodName: "completeWithdraw",
        submitMessage: "✅ Withdraw completion submitted",
        onSubmit: () => {
          setListeningForCompleteWithdraw(true);
        },
        completeMessage: "✅ Your withdraw was completed.",
        onComplete: () => {
          setListeningForCompleteWithdraw(false);
          updateWithdrawState();
          if (account) {
            updatePosition(account);
          }
        },
      });
    }
  };

  const initiatedIsDisabled =
    !(inputValue && account) ||
    listeningForInitiation ||
    ethers.utils.parseUnits(inputValue)._hex === ZERO_UINT_256;
  const completeIsDisabled = listeningForCompleteWithdraw;

  return (
    <div className="flex-col items-center justify-between h-full">
      <div className="w-full h-8 bg-black text-white px-2 flex items-center justify-start">
        <p>
          <b>1. Initiate</b>
        </p>
      </div>
      <div className="flex border-b-2 border-black">
        <div className="border-r-2 border-black w-16 flex justify-center items-center">
          <div className="w-7 h-7 rounded-full border-black border-2 flex justify-center items-center">
            <div className="w-4 h-4 rounded-full border-black border-2" />
          </div>
        </div>
        {withdrawEpochComplete ? (
          <div className="p-2">
            <p className="text-xs">
              You must complete your withdrawal from the previous epoch before
              initiating another withdrawal.
            </p>
          </div>
        ) : (
          <div className="w-full">
            <div className="w-full">
              <div className="p-2 text-right">
                <p className="text-xs">
                  Balance:{" "}
                  <RequiresWalletConnection className="w-[60px] h-[16px] mr-2 translate-y-[-2px]">
                    <BigNumberDisplay currency={Currency.RYSK}>
                      {redeemedShares && unredeemedShares
                        ? redeemedShares?.add(unredeemedShares)
                        : null}
                    </BigNumberDisplay>
                  </RequiresWalletConnection>{" "}
                  {DHV_NAME}
                  <VaultWithdrawBalanceTooltip />
                </p>
              </div>
            </div>
            <div className="ml-[-2px]">
              <TextInput
                className="pl-[80px] p-4 text-xl border-r-0"
                setValue={(value) => handleInputChange(value)}
                value={inputValue}
                iconLeft={
                  <div className="h-full flex items-center px-4 text-right text-cyan-dark cursor-default">
                    <p>{DHV_NAME}</p>
                  </div>
                }
                numericOnly
                maxNumDecimals={DECIMALS.RYSK}
                maxValue={withdrawableDHV ?? undefined}
                maxValueDecimals={DECIMALS.RYSK}
                maxButtonHandler={
                  withdrawableDHV ? () => handleSliderChange(100) : undefined
                }
                maxLength={30}
              />
            </div>
            <div className="ml-[-2px] py-2 px-4 border-b-2 border-black h-12">
              <ReactSlider
                className="horizontal-slider"
                value={sliderPercentage}
                onChange={handleSliderChange}
                renderTrack={(
                  { className: trackClassName, ...trackProps },
                  { index, value }
                ) => {
                  return (
                    <div
                      className={`${
                        index === 0 &&
                        "bg-black h-1 w-full rounded-full translate-y-[6px]"
                      } ${trackClassName}`}
                      {...trackProps}
                    ></div>
                  );
                }}
                marks
                renderThumb={({ className: thumbClassName, ...thumbProps }) => (
                  <div
                    {...thumbProps}
                    className={`${thumbClassName} p-2 flex items-center justify-center bg-bone rounded-full border-2 border-black translate-y-[-1px] cursor-pointer`}
                  ></div>
                )}
              />
              <div className="w-full flex justify-between items-center mt-5 text-xs">
                <p
                  className="w-0 translate-x-[-50%] cursor-pointer"
                  onClick={() => handleSliderChange(0)}
                >
                  0%
                </p>
                <p
                  className="w-0 translate-x-[-4px] cursor-pointer"
                  onClick={() => handleSliderChange(25)}
                >
                  25%
                </p>
                <p
                  className="w-0 translate-x-[-8px] cursor-pointer"
                  onClick={() => handleSliderChange(50)}
                >
                  50%
                </p>
                <p
                  className="w-0 translate-x-[-16px] cursor-pointer"
                  onClick={() => handleSliderChange(75)}
                >
                  75%
                </p>
                <p
                  className="w-0 translate-x-[-22px] cursor-pointer"
                  onClick={() => handleSliderChange(100)}
                >
                  100%
                </p>
              </div>
            </div>
            <div className="ml-[-2px] px-2 py-4 border-b-[2px] border-black text-[16px]">
              <div className="flex justify-between items-center">
                <div className="flex">
                  <p>Withdraw on hold</p>
                  <RyskTooltip
                    tooltipProps={{ className: "max-w-[350px]" }}
                    message={WITHDRAW_SHARES_EPOCH}
                    id={"strategeyTip"}
                  />
                </div>

                <div className="h-4 flex items-center">
                  {listeningForInitiation && (
                    <Loader className="mr-2 !h-[24px]" />
                  )}
                  <p>
                    <RequiresWalletConnection className="translate-y-[-6px] w-[80px] h-[12px]">
                      <BigNumberDisplay currency={Currency.RYSK}>
                        {withdrawReceipt?.shares ?? null}
                      </BigNumberDisplay>
                    </RequiresWalletConnection>{" "}
                    {DHV_NAME}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex">
              <>
                <Button
                  onClick={() => {
                    if (inputValue) {
                      handleInitiateWithdraw();
                    }
                  }}
                  className={`w-full !py-6 !border-0 text-white ${
                    initiatedIsDisabled ? "!bg-gray-300" : ""
                  }`}
                  disabled={initiatedIsDisabled}
                  color="black"
                  requiresConnection
                >
                  {listeningForInitiation
                    ? "⏱ Awaiting initiation"
                    : "Initiate"}
                </Button>
              </>
            </div>
          </div>
        )}
      </div>
      <div>
        <div className="h-4" />
        <div className="w-full h-8 bg-black text-white px-2 flex items-center justify-start">
          <p>
            <b>2. Complete</b>
          </p>
        </div>
        {withdrawEpochComplete ? (
          <div>
            <div>
              <div className="px-2 py-4">
                <div className="flex justify-between">
                  <p>Available USDC</p>
                  <p>
                    <RequiresWalletConnection className="translate-y-[-6px] w-[80px] h-[12px]">
                      <BigNumberDisplay currency={Currency.USDC}>
                        {withdrawableUSDC}
                      </BigNumberDisplay>
                    </RequiresWalletConnection>{" "}
                    USDC
                  </p>
                </div>
                <hr className="border-black mb-2 mt-1" />
                <div className="text-xs text-right">
                  <PendingWithdrawBreakdown />
                </div>
              </div>
              <Button
                onClick={() => {
                  handleCompleteWithdraw();
                }}
                className={`w-full !py-6 !border-b-0 !border-x-0 border-t-[2px] border-black bg-black text-white`}
                disabled={completeIsDisabled}
                color="black"
                requiresConnection
              >
                {completeIsDisabled ? "⏱ Awaiting complete" : "Complete"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-2">
            <p className="text-sm">{WITHDRAW_SHARES_EPOCH}</p>
          </div>
        )}
      </div>
    </div>
  );
};
