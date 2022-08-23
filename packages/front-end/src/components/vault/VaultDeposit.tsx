import React from "react";
import { BigNumber, ethers, utils } from "ethers";
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
import addresses from "../../contracts.json";
import { useContract } from "../../hooks/useContract";
import { VaultActionType } from "../../state/types";
import { useVaultContext } from "../../state/VaultContext";
import {
  ContractAddresses,
  Currency,
  DepositReceipt,
  ETHNetwork,
} from "../../types";
import { BigNumberDisplay } from "../BigNumberDisplay";
import { Loader } from "../Loader";
import { RequiresWalletConnection } from "../RequiresWalletConnection";
import { RyskTooltip } from "../RyskTooltip";
import { Button } from "../shared/Button";
import { TextInput } from "../shared/TextInput";
import { Toggle } from "../shared/Toggle";
import { useUserPosition } from "../../hooks/useUserPosition";
import { createFalse } from "typescript";

export const VaultDeposit = () => {
  const { account, network } = useWalletContext();
  const {
    state: {
      depositEpoch: currentEpoch,
      depositPricePerShare: currentPricePerShare,
    },
    dispatch,
  } = useVaultContext();
  const { updatePosition } = useUserPosition();

  // UI State
  const [inputValue, setInputValue] = useState("");
  const [listeningForApproval, setListeningForApproval] = useState(false);
  const [listeningForDeposit, setListeningForDeposit] = useState(false);
  const [listeningForRedeem, setListeningForRedeem] = useState(false);

  // Chain state
  const [userUSDCBalance, setUserUSDCBalance] = useState<BigNumber | null>(
    null
  );
  const [depositReceipt, setDepositReceipt] = useState<DepositReceipt | null>(
    null
  );
  const [pendingDepositedUSDC, setPendingDepositedUSDC] =
    useState<BigNumber | null>(null);
  const [unredeemedShares, setUnredeemedShares] = useState<BigNumber | null>(
    null
  );

  const [unlimitedApproval, setUnlimitedApproval] = useState(false);
  const [approvedAmount, setApprovedAmount] = useState<BigNumber | null>(null);

  // Contracts
  const [lpContract, lpContractCall] = useContract<{
    DepositEpochExecuted: [];
  }>({
    contract: "liquidityPool",
    ABI: LPABI.abi,
    readOnly: false,
    events: {
      DepositEpochExecuted: () => {
        epochListener();
      },
    },
    isListening: {
      DepositEpochExecuted: true,
    },
  });

  const [usdcContract, usdcContractCall] = useContract({
    contract: "USDC",
    ABI: ERC20ABI,
    readOnly: false,
  });

  const getUSDCBalance = useCallback(
    async (address: string) => {
      const balance = await usdcContract?.balanceOf(address);
      setUserUSDCBalance(balance);
      return balance;
    },
    [usdcContract]
  );

  const getRedeemedShares = useCallback(
    async (address: string) => {
      const sharesBalance: BigNumber | null = await lpContract?.balanceOf(
        address
      );
      dispatch({
        type: VaultActionType.SET,
        data: { userDHVBalance: sharesBalance },
      });
      return sharesBalance;
    },
    [lpContract, dispatch]
  );

  const getDepositReceipt = useCallback(
    async (address: string) => {
      const depositReceipt: DepositReceipt = await lpContract?.depositReceipts(
        address
      );
      setDepositReceipt(depositReceipt);
      return depositReceipt;
    },
    [lpContract]
  );

  const getPendingDepositedUSDC = useCallback(
    async (depositReceipt: DepositReceipt, currentEpoch: BigNumber) => {
      const isPendingUSDC = depositReceipt.epoch.eq(currentEpoch);
      if (isPendingUSDC) {
        setPendingDepositedUSDC(depositReceipt.amount);
      } else {
        setPendingDepositedUSDC(BigNumber.from(0));
      }
    },
    []
  );

  const getUnredeemedShares = useCallback(
    (
      depositReceipt: DepositReceipt,
      currentEpochSharePrice: BigNumber,
      currentEpoch: BigNumber
    ) => {
      const receiptEpochHasRun = depositReceipt.epoch.lt(currentEpoch);
      // When making conversion from amount (USDC) to RYSK, need to
      // account for decimals. Hence scaling by BIG_NUMBER_DECIMALS values.
      const receiptAmountInShares = receiptEpochHasRun
        ? depositReceipt.amount
            // Making e24
            .mul(BIG_NUMBER_DECIMALS.RYSK)
            // Now e6
            .div(currentEpochSharePrice)
            // Now back to e18
            .mul(BIG_NUMBER_DECIMALS.RYSK.div(BIG_NUMBER_DECIMALS.USDC))
        : BigNumber.from(0);
      const totalRedeemableShares = receiptAmountInShares.add(
        depositReceipt.unredeemedShares
      );
      setUnredeemedShares(totalRedeemableShares);
    },
    []
  );

  const updateDepositState = useCallback(async () => {
    if (account && currentPricePerShare && currentEpoch) {
      await getUSDCBalance(account);
      const depositReceipt = await getDepositReceipt(account);
      await getUnredeemedShares(
        depositReceipt,
        currentPricePerShare,
        currentEpoch
      );
      await getPendingDepositedUSDC(depositReceipt, currentEpoch);
    }
  }, [
    account,
    currentEpoch,
    currentPricePerShare,
    getDepositReceipt,
    getPendingDepositedUSDC,
    getUSDCBalance,
    getUnredeemedShares,
  ]);

  const epochListener = useCallback(async () => {
    updateDepositState();
    if (account) {
      getRedeemedShares(account);
      updatePosition(account);
    }
  }, [updateDepositState, account, getRedeemedShares, updatePosition]);

  const getAllowance = useCallback(async () => {
    if (account) {
      const allowance = await usdcContract?.allowance(
        account,
        lpContract?.address
      );
      setApprovedAmount(allowance);
    }
  }, [account, usdcContract, lpContract]);

  useEffect(() => {
    (async () => {
      await updateDepositState();
      await getAllowance();
    })();
  }, [updateDepositState, getAllowance]);

  // UI Handlers
  const handleInputChange = (value: string) => {
    setInputValue(value);
  };

  // Handlers for the different possible vault interactions.
  const handleApproveSpend = async () => {
    if (usdcContract && network) {
      const amount = ethers.utils.parseUnits(inputValue, DECIMALS.USDC);
      const approvedAmount = (await usdcContract.allowance(
        account,
        (addresses as Record<ETHNetwork, ContractAddresses>)[network.name][
          "liquidityPool"
        ]
      )) as BigNumber;
      try {
        if (approvedAmount.lt(amount)) {
          await usdcContractCall({
            method: usdcContract.approve,
            args: [
              (addresses as Record<ETHNetwork, ContractAddresses>)[
                network.name
              ]["liquidityPool"],
              unlimitedApproval ? ethers.BigNumber.from(MAX_UINT_256) : amount,
            ],
            submitMessage: "✅ Approval submitted",
            onComplete: async () => {
              debugger;
              await getAllowance();
            },
            completeMessage: "✅ Approval complete",
          });
        } else {
          if (account && lpContract) {
            toast("✅ Your transaction is already approved");
          }
        }
      } catch {
        toast("❌ There was an error approving your transaction.");
        setListeningForApproval(false);
      }
    }
  };

  const handleDepositCollateral = async () => {
    if (usdcContract && lpContract && account && network) {
      const amount = ethers.utils.parseUnits(inputValue, DECIMALS.USDC);
      await lpContractCall({
        method: lpContract.deposit,
        args: [amount],
        submitMessage: "✅ Deposit submitted",
        onSubmit: () => {
          setListeningForDeposit(true);
        },
        completeMessage:
          "✅ Deposit complete. You can redeem your shares once this epoch is executed.",
        onComplete: () => {
          setInputValue("");
          updateDepositState();
          setListeningForDeposit(false);
          if (account) {
            updatePosition(account);
          }
        },
      });
    }
  };

  const handleRedeemShares = async () => {
    if (lpContract) {
      await lpContractCall({
        method: lpContract.redeem,
        args: [MAX_UINT_256],
        submitMessage: "✅ Redeem submitted",
        onSubmit: () => {
          setListeningForRedeem(true);
        },
        completeMessage: "✅ Redeem complete.",
        onComplete: () => {
          updateDepositState();
          setListeningForRedeem(false);
          if (account) {
            updatePosition(account);
          }
        },
      });
    }
  };

  const amountIsApproved =
    inputValue && approvedAmount
      ? ethers.utils.parseUnits(inputValue, 6).lte(approvedAmount)
      : false;

  const approveIsDisabled =
    !inputValue ||
    amountIsApproved ||
    listeningForApproval ||
    ethers.utils.parseUnits(inputValue)._hex === ZERO_UINT_256;
  const depositIsDisabled = !(inputValue && account && approveIsDisabled);
  const redeemIsDisabled = listeningForRedeem;

  return (
    <div className="flex-col items-center justify-between h-full">
      <div className="w-full h-8 bg-black text-white px-2 flex items-center justify-start">
        <p>
          <b>1. Deposit USDC</b>
        </p>
      </div>
      <div className="flex border-b-2 border-black">
        <div className="border-r-2 border-black w-16 flex justify-center items-center">
          <div className="w-7 h-7 rounded-full border-black border-2 flex justify-center items-center">
            <div className="w-4 h-4 rounded-full border-black border-2" />
          </div>
        </div>
        <div className="w-full">
          <div className="w-full">
            <div className="p-2 text-right">
              <p className="text-xs">
                Balance:{" "}
                <RequiresWalletConnection className="w-[60px] h-[16px] mr-2 translate-y-[-2px]">
                  <BigNumberDisplay currency={Currency.USDC}>
                    {userUSDCBalance}
                  </BigNumberDisplay>
                </RequiresWalletConnection>{" "}
                USDC
              </p>
            </div>
          </div>
          <div className="ml-[-2px]">
            <TextInput
              className="text-right p-4 text-xl border-r-0"
              setValue={handleInputChange}
              value={inputValue}
              iconLeft={
                <div className="h-full flex items-center px-4 text-right text-gray-600">
                  <p>USDC</p>
                </div>
              }
              maxNumDecimals={18}
              numericOnly
              maxValue={userUSDCBalance ?? undefined}
              maxValueDecimals={6}
              maxButtonHandler={
                userUSDCBalance
                  ? () => {
                      if (userUSDCBalance) {
                        handleInputChange(
                          ethers.utils.formatUnits(userUSDCBalance, 6)
                        );
                      }
                    }
                  : undefined
              }
            />
          </div>
          <div className="ml-[-2px] px-2 py-4 border-b-[2px] border-black text-[16px]">
            <div className="flex justify-between items-center">
              <div className="flex">
                <p>Deposits on hold</p>
                <RyskTooltip
                  message={
                    "Your USDC will be deployed to our vault and converted to shares every Friday at 11am UTC"
                  }
                  id={"strategeyTip"}
                />
              </div>
              <div className="h-4 flex items-center">
                {listeningForDeposit && <Loader className="mr-2" />}
                <p>
                  <RequiresWalletConnection className="translate-y-[-6px] w-[80px] h-[12px]">
                    <BigNumberDisplay currency={Currency.USDC}>
                      {pendingDepositedUSDC}
                    </BigNumberDisplay>
                  </RequiresWalletConnection>{" "}
                  USDC
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center border-b-2 border-black p-2 justify-between">
            <p className="text-[12px] mr-2">Unlimited Approval: </p>
            <Toggle
              value={unlimitedApproval}
              setValue={setUnlimitedApproval}
              size="sm"
            />
          </div>
          <div className="flex">
            <>
              <Button
                onClick={handleApproveSpend}
                className={`w-full !py-6 !border-0 bg-black text-white`}
                disabled={approveIsDisabled}
                color="black"
                requiresConnection
              >
                {amountIsApproved
                  ? "✅ Approved"
                  : listeningForApproval
                  ? "⏱ Awaiting Approval"
                  : "Approve"}
              </Button>
              {account && (
                <Button
                  onClick={() => {
                    if (inputValue) {
                      handleDepositCollateral();
                    }
                  }}
                  className={`w-full !py-6 !border-0 bg-black text-white ${
                    depositIsDisabled ? "!bg-gray-300" : ""
                  }`}
                  disabled={depositIsDisabled}
                  color="black"
                >
                  {listeningForDeposit ? "⏱ Awaiting deposit" : "Deposit"}
                </Button>
              )}
            </>
          </div>
        </div>
      </div>
      <div>
        <div className="h-4" />
        <div className="w-full h-8 bg-black text-white px-2 flex items-center justify-start">
          <p>
            <b>2. Redeem</b>
          </p>
        </div>
        <div>
          <div>
            {unredeemedShares ? (
              unredeemedShares._hex !== ZERO_UINT_256 ? (
                <>
                  <div className="px-2 py-4">
                    <div className="flex justify-between">
                      <p>Unredeemed Shares</p>
                      <p>
                        <RequiresWalletConnection className="translate-y-[-6px] w-[80px] h-[12px]">
                          <BigNumberDisplay currency={Currency.RYSK}>
                            {unredeemedShares}
                          </BigNumberDisplay>
                        </RequiresWalletConnection>{" "}
                        {DHV_NAME}
                      </p>
                    </div>
                    <hr className="border-black mb-2 mt-1" />
                    <div className="text-xs text-right">
                      <p>
                        100 {DHV_NAME} @ 20.12 USDC per {DHV_NAME}
                      </p>
                      <p>
                        1000 {DHV_NAME} @ 18.23 USDC per {DHV_NAME}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      handleRedeemShares();
                    }}
                    className={`w-full !py-6 !border-b-0 !border-x-0 border-t-[2px] border-black bg-black text-white`}
                    disabled={redeemIsDisabled}
                    color="black"
                  >
                    {redeemIsDisabled ? "⏱ Awaiting redeem" : "Redeem"}
                  </Button>
                </>
              ) : (
                <p className="text-xs p-2">
                  Your USDC will be available to redeem as shares during our
                  weekly strategy every Friday at 11am UTC
                </p>
              )
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
