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
import addresses from "../../contracts.json";
import { useContract } from "../../hooks/useContract";
import { ActionType, AppSettings, VaultActionType } from "../../state/types";
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
import { DEPOSIT_SHARES_EPOCH } from "../../config/messages";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { useGlobalContext } from "../../state/GlobalContext";
import { LOCAL_STORAGE_SETTINGS_KEY } from "../dashboard/Settings";
import { UnredeemedDepositBreakdown } from "./UnredeemedDepositBreakdown";

export const VaultDeposit = () => {
  const { account, network } = useWalletContext();
  const {
    state: {
      depositEpoch: currentEpoch,
      depositPricePerShare: currentPricePerShare,
    },
    dispatch,
  } = useVaultContext();
  const [_, setLocalStorage] = useLocalStorage();
  const {
    dispatch: globalDispatch,
    state: { settings },
  } = useGlobalContext();
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

  const setUnlimitedApproval = (value: boolean) => {
    const updatedSettings: AppSettings = {
      ...settings,
      vaultDepositUnlimitedApproval: value,
    };
    setLocalStorage(LOCAL_STORAGE_SETTINGS_KEY, updatedSettings);
    globalDispatch({
      type: ActionType.SET_SETTINGS,
      settings: updatedSettings,
    });
  };

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
        if (
          approvedAmount.lt(amount) ||
          settings.vaultDepositUnlimitedApproval
        ) {
          await usdcContractCall({
            method: usdcContract.approve,
            args: [
              (addresses as Record<ETHNetwork, ContractAddresses>)[
                network.name
              ]["liquidityPool"],
              settings.vaultDepositUnlimitedApproval
                ? ethers.BigNumber.from(MAX_UINT_256)
                : amount,
            ],
            submitMessage: "✅ Approval submitted",
            onComplete: async () => {
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
        scaleGasLimit: true,
        methodName: "deposit",
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
          getAllowance();
          if (account) {
            updatePosition(account);
          }
        },
        onFail: () => {
          setListeningForDeposit(false);
        },
      });
    }
  };

  const handleRedeemShares = async () => {
    if (lpContract) {
      await lpContractCall({
        method: lpContract.redeem,
        args: [MAX_UINT_256],
        scaleGasLimit: true,
        methodName: "redeem",
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
    (inputValue && approvedAmount
      ? ethers.utils.parseUnits(inputValue, DECIMALS.USDC).lte(approvedAmount)
      : false) &&
    // Kinda arbitrary condition to check if the user has previously
    // enabled unlimited approval.
    (settings.vaultDepositUnlimitedApproval
      ? approvedAmount?.gt(BigNumber.from(MAX_UINT_256).div(2))
      : true);

  const approveIsDisabled =
    !inputValue ||
    amountIsApproved ||
    listeningForApproval ||
    ethers.utils.parseUnits(inputValue)._hex === ZERO_UINT_256;
  const depositIsDisabled =
    !(inputValue && account && approveIsDisabled) || listeningForDeposit;
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
              className="pl-[64px] p-4 text-xl border-r-0"
              setValue={handleInputChange}
              value={inputValue}
              iconLeft={
                <div className="h-full flex items-center px-4 text-right text-cyan-dark cursor-default">
                  <p>USDC</p>
                </div>
              }
              maxNumDecimals={DECIMALS.USDC}
              numericOnly
              maxValue={userUSDCBalance ?? undefined}
              maxValueDecimals={6}
              maxButtonHandler={
                userUSDCBalance
                  ? () => {
                      if (userUSDCBalance) {
                        handleInputChange(
                          ethers.utils.formatUnits(
                            userUSDCBalance,
                            DECIMALS.USDC
                          )
                        );
                      }
                    }
                  : undefined
              }
              maxLength={30}
            />
          </div>
          <div className="ml-[-2px] px-2 py-4 border-b-[2px] border-black text-[16px]">
            <div className="flex justify-between items-center">
              <div className="flex">
                <p>Deposits on hold</p>
                <RyskTooltip
                  message={DEPOSIT_SHARES_EPOCH}
                  id={"strategeyTip"}
                  tooltipProps={{ className: "max-w-[350px]" }}
                />
              </div>
              <div className="h-4 flex items-center">
                {listeningForDeposit && <Loader className="mr-2 !h-[24px]" />}
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
              value={settings.vaultDepositUnlimitedApproval}
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
            {unredeemedShares && unredeemedShares._hex !== ZERO_UINT_256 ? (
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
                  <UnredeemedDepositBreakdown />
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
              <p className="text-sm p-2">{DEPOSIT_SHARES_EPOCH}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
