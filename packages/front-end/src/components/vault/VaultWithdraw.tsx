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
import { VaultActionType } from "../../state/types";
import { useVaultContext } from "../../state/VaultContext";
import { Address, Currency, WithdrawalReceipt } from "../../types";
import { BigNumberDisplay } from "../BigNumberDisplay";
import { RequiresWalletConnection } from "../RequiresWalletConnection";
import { RyskTooltip } from "../RyskTooltip";
import { Button } from "../shared/Button";
import { TextInput } from "../shared/TextInput";
import { Loader } from "../Loader";

export const VaultWithdraw = () => {
  const { account, network } = useWalletContext();
  const {
    state: {
      depositEpoch: currentEpoch,
      depositPricePerShare: currentPricePerShare,
      userDHVBalance: userRyskBalance,
    },
    dispatch,
  } = useVaultContext();

  const {
    state: { settings },
  } = useGlobalContext();

  // UI State
  const [inputValue, setInputValue] = useState("");
  const [listeningForInitiation, setListeningForInitiation] = useState(false);
  const [listeningForCompleteWithdraw, setListeningForCompleteWithdraw] =
    useState(false);
  const [withdrawEpochComplete, setWithdrawEpochComplete] = useState(false);
  const [withdrawableUSDC, setWithdrawableUSDC] = useState<BigNumber | null>(
    null
  );

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

  const getUserRYSKBalance = useCallback(
    async (address: string) => {
      const balance = await lpContract?.balanceOf(address);
      dispatch({
        type: VaultActionType.SET,
        data: { userDHVBalance: balance },
      });
      return balance;
    },
    [lpContract, dispatch]
  );

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
      getUserRYSKBalance(account);
    }
  }, [updateWithdrawState, account, getUserRYSKBalance]);

  useEffect(() => {
    (async () => {
      await updateWithdrawState();
    })();
  }, [updateWithdrawState]);

  const handleInitiateWithdraw = async () => {
    if (usdcContract && lpContract && account && network) {
      const amount = ethers.utils.parseUnits(inputValue, DECIMALS.RYSK);
      await lpContractCall({
        method: lpContract.initiateWithdraw,
        args: [amount],
        submitMessage: "✅ Withdraw initiation submitted",
        onSubmit: () => {
          setListeningForInitiation(true);
        },
        completeMessage:
          "✅ Your withdraw was initiated. You will be able to complete it when this epoch is executed.",

        onComplete: () => {
          setListeningForInitiation(false);
          updateWithdrawState();
          getUserRYSKBalance(account);
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
        submitMessage: "✅ Withdraw completion submitted",
        onSubmit: () => {
          setListeningForCompleteWithdraw(true);
        },
        completeMessage: "✅ Your withdraw was completed.",
        onComplete: () => {
          setListeningForCompleteWithdraw(false);
          updateWithdrawState();
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
                      {userRyskBalance}
                    </BigNumberDisplay>
                  </RequiresWalletConnection>{" "}
                  {DHV_NAME}
                </p>
              </div>
            </div>
            <div className="ml-[-2px]">
              <TextInput
                className="text-right p-4 text-xl border-r-0"
                setValue={(value) => setInputValue(value)}
                value={inputValue}
                iconLeft={
                  <div className="h-full flex items-center px-4 text-right text-gray-600">
                    <p>{DHV_NAME}</p>
                  </div>
                }
                numericOnly
                maxNumDecimals={18}
                maxValue={userRyskBalance ?? undefined}
                maxValueDecimals={18}
                maxButtonHandler={
                  userRyskBalance
                    ? () => {
                        if (userRyskBalance) {
                          setInputValue(
                            ethers.utils.formatUnits(userRyskBalance, 18)
                          );
                        }
                      }
                    : undefined
                }
              />
            </div>
            <div className="ml-[-2px] px-2 py-4 border-b-[2px] border-black text-[16px]">
              <div className="flex justify-between">
                <div className="flex">
                  <p>Withdraw on hold</p>
                  <RyskTooltip
                    tooltipProps={{ className: "max-w-[350px]" }}
                    message={
                      `Your ${DHV_NAME} shares will be withdrawn from the vault and converted to USDC every Friday at 11am UTC`
                    }
                    id={"strategeyTip"}
                  />
                </div>

                <div className="h-4 flex items-center">
                  {listeningForInitiation && <Loader className="mr-2" />}
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
                  <p>100 {DHV_NAME} @ 20.12 USDC per {DHV_NAME}</p>
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
            <p className="text-xs">
              Your USDC will be available to withdraw during our weekly strategy
              every Friday at 11am
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
