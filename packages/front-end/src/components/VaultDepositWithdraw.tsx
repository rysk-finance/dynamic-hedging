import { BigNumber, ethers } from "ethers";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import ERC20ABI from "../abis/erc20.json";
import { useWalletContext } from "../App";
import LPABI from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json";
import {
  BIG_NUMBER_DECIMALS,
  DECIMALS,
  MAX_UINT_256,
  ZERO_UINT_256,
} from "../config/constants";
import addresses from "../contracts.json";
import { useContract } from "../hooks/useContract";
import { useQueryParams } from "../hooks/useQueryParams";
import { useGlobalContext } from "../state/GlobalContext";
import { DepositReceipt, Events, WithdrawalReceipt } from "../types";
import { RequiresWalletConnection } from "./RequiresWalletConnection";
import { RadioButtonSlider } from "./shared/RadioButtonSlider";
import { TextInput } from "./shared/TextInput";
import { UserPosition } from "./UserPosition";

enum Mode {
  DEPOSIT = "Deposit",
  WITHDRAW = "Withdraw",
}

enum DepositMode {
  USDC = "USDC",
  REDEEM = "Redeem",
}

enum WithdrawMode {
  INITIATE = "Initiate",
  COMPLETE = "Complete",
}

export const VaultDepositWithdraw = () => {
  const { account, network } = useWalletContext();

  const {
    state: { settings },
  } = useGlobalContext();

  const queryParams = useQueryParams();

  // UI State
  const [mode, setMode] = useState<Mode>(Mode.DEPOSIT);
  const [depositMode, setDepositMode] = useState<DepositMode>(DepositMode.USDC);
  const [withdrawMode, setWithrawMode] = useState<WithdrawMode>(
    WithdrawMode.INITIATE
  );
  const [inputValue, setInputValue] = useState("");
  const [listeningForApproval, setListeningForApproval] = useState(false);
  const [listeningForDeposit, setListeningForDeposit] = useState(false);
  const [listeningForRedeem, setListeningForRedeem] = useState(false);
  const [listeningForWithdrawInit, setListeningForWithdrawInit] =
    useState(false);
  const [listeningForWithdrawComplete, setListeningForWithdrawComplete] =
    useState(false);

  // Chain state
  const [currentEpoch, setCurrentEpoch] = useState<BigNumber | null>(null);
  const [redeemedShares, setRedeemedShares] = useState<BigNumber | null>(null);
  const [unredeemableCollateral, setUnredeemableCollateral] =
    useState<BigNumber | null>(null);
  const [unredeemedShares, setUnredeemedShares] = useState<BigNumber | null>(
    null
  );
  const [withdrawalReceipt, setwithdrawalReceipt] =
    useState<WithdrawalReceipt | null>(null);
  const [withdrawEpochSharePrice, setWithdrawEpochSharePrice] =
    useState<BigNumber | null>(null);
  const [approvalState, setApprovalState] = useState<Events["Approval"] | null>(
    null
  );

  useEffect(() => {
    const type = queryParams.get("type");
    if (type && type === "withdraw") {
      setMode(Mode.WITHDRAW);
    }
  }, [queryParams]);

  const initiateWithdrawDisabled =
    withdrawalReceipt && withdrawalReceipt.shares._hex !== ZERO_UINT_256;

  // lpContract?.on("Withdraw", updateWithdrawState);
  // lpContract?.on("InitiateWithdraw", updateWithdrawState);

  // Contracts
  const [lpContract, lpContractCall] = useContract<{
    EpochExecuted: [];
    Deposit: [BigNumber, BigNumber, BigNumber];
    Redeem: [];
    InitiateWithdraw: [];
    Withdraw: [];
  }>({
    contract: "liquidityPool",
    ABI: LPABI.abi,
    readOnly: false,
    events: {
      EpochExecuted: () => {
        // TODO: Update copy here
        toast("✅ The epoch was advanced");
        epochListener();
      },
      Deposit: () => {
        setListeningForDeposit(false);
        toast("✅ Deposit complete");
        updateDepositState();
      },
      Redeem: () => {
        setListeningForRedeem(false);
        toast("✅ Redeem completed");
        updateDepositState();
      },
      InitiateWithdraw: () => {
        toast("✅ Your withdrawal was initiated");
        updateWithdrawState();
        setListeningForWithdrawComplete(false);
      },
      Withdraw: () => {
        toast("✅ Your withdrawal was completed");
        updateWithdrawState();
        setListeningForWithdrawComplete(false);
      },
    },
    isListening: {
      EpochExecuted: true,
      Deposit: listeningForDeposit,
      Redeem: listeningForRedeem,
      InitiateWithdraw: listeningForWithdrawInit,
      Withdraw: listeningForWithdrawComplete,
    },
  });

  const [usdcContract, usdcContractCall] = useContract<{
    Approval: [string, string, BigNumber];
  }>({
    contract: "USDC",
    ABI: ERC20ABI,
    readOnly: false,
    events: {
      Approval: (owner, spender, value) => {
        setApprovalState({ owner, spender, value });
        setListeningForApproval(false);
        toast("✅ Approval complete");
      },
    },
    isListening: { Approval: listeningForApproval },
  });

  const getBalance = useCallback(
    async (address: string) => {
      const balance = await lpContract?.balanceOf(address);
      setRedeemedShares(balance);
    },
    [lpContract]
  );

  const updateDepositState = useCallback(async () => {
    if (lpContract && account) {
      const depositReceipt: DepositReceipt = await lpContract.depositReceipts(
        account
      );
      const currentEpoch: BigNumber = await lpContract.epoch();
      const previousUnredeemedShares = depositReceipt.unredeemedShares;
      // If true, the share price for the most recent deposit hasn't been calculated
      // so we can only show the collateral balance, not the equivalent number of shares.
      if (currentEpoch._hex === depositReceipt.epoch._hex) {
        setUnredeemedShares(previousUnredeemedShares);
        if (depositReceipt.amount.toNumber() !== 0) {
          setUnredeemableCollateral(depositReceipt.amount);
        }
      } else {
        setUnredeemableCollateral(null);
        const pricePerShareAtEpoch: BigNumber =
          await lpContract.epochPricePerShare(depositReceipt.epoch);
        // TODO(HC): Price oracle is returning 1*10^18 for price so having to adjust price
        // whilst building out to avoid share numbers being too small. Once price oracle is returning
        // more accurate
        const newUnredeemedShares = depositReceipt.amount
          .div(BIG_NUMBER_DECIMALS.USDC)
          .mul(BIG_NUMBER_DECIMALS.RYSK)
          .div(pricePerShareAtEpoch)
          .mul(BIG_NUMBER_DECIMALS.RYSK);
        const sharesToRedeem =
          previousUnredeemedShares.add(newUnredeemedShares);
        setUnredeemedShares(sharesToRedeem);
      }
      getBalance(account);
    }
  }, [account, lpContract, getBalance]);

  const updateWithdrawState = useCallback(async () => {
    if (lpContract && account) {
      const withdrawalReceipt: WithdrawalReceipt =
        await lpContract.withdrawalReceipts(account);
      setwithdrawalReceipt(withdrawalReceipt);
      const withdrawSharePrice = await lpContract.epochPricePerShare(
        withdrawalReceipt.epoch
      );
      setWithdrawEpochSharePrice(withdrawSharePrice);
      getBalance(account);
    }
  }, [account, lpContract, getBalance]);

  const epochListener = useCallback(async () => {
    updateDepositState();
    updateWithdrawState();
    if (lpContract) {
      const epoch = await lpContract.epoch();
      setCurrentEpoch(epoch);
    }
  }, [updateDepositState, updateWithdrawState, lpContract]);

  useEffect(() => {
    (async () => {
      if (account) {
        await getBalance(account);
        await epochListener();
      }
    })();
  }, [getBalance, account, epochListener]);

  // Update UI buttons when switching between deposit/withdraw mode
  useEffect(() => {
    setDepositMode(DepositMode.USDC);
    setInputValue("");
  }, [mode, initiateWithdrawDisabled]);

  // Ensure the initiate withdraw button gets disabled if a deposit has already
  // been initiated.
  useEffect(() => {
    setWithrawMode(
      initiateWithdrawDisabled ? WithdrawMode.COMPLETE : WithdrawMode.INITIATE
    );
  }, [mode, initiateWithdrawDisabled]);

  // Reset input value when switching mode
  useEffect(() => {
    setInputValue("");
  }, [mode, depositMode, withdrawMode]);

  // UI Handlers
  const handleInputChange = (value: string) => {
    setInputValue(value);
    setApprovalState(null);
  };

  // Handlers for the different possible vault interactions.
  const handleApproveSpend = async () => {
    if (usdcContract && network) {
      const amount = BIG_NUMBER_DECIMALS.RYSK.mul(BigNumber.from(inputValue));
      const approvedAmount = (await usdcContract.allowance(
        account,
        addresses[network.name]["liquidityPool"]
      )) as BigNumber;
      try {
        if (!settings.unlimitedApproval || approvedAmount.lt(amount)) {
          await usdcContractCall({
            method: usdcContract.approve,
            args: [
              addresses[network.name]["liquidityPool"],
              settings.unlimitedApproval
                ? ethers.BigNumber.from(MAX_UINT_256)
                : amount,
            ],
            successMessage: "✅ Approval submitted",
          });
          setListeningForApproval(true);
        } else {
          toast("✅ Your transaction is already approved");
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
        successMessage: "✅ Deposit submitted",
        onComplete: () => {
          setApprovalState(null);
        },
      });
      setListeningForDeposit(true);
    }
  };

  const handleRedeemShares = async () => {
    if (lpContract) {
      const amount = ethers.utils.parseUnits(inputValue, DECIMALS.RYSK);
      await lpContractCall({ method: lpContract.redeem, args: [amount] });
      setListeningForRedeem(true);
    }
  };

  const handleInitiateWithdraw = async () => {
    if (lpContract) {
      const amount = ethers.utils.parseUnits(inputValue, DECIMALS.RYSK);
      await lpContractCall({
        method: lpContract.initiateWithdraw,
        args: [amount],
      });
      setListeningForWithdrawInit(true);
    }
  };

  const handleCompleteWithdraw = async () => {
    if (lpContract && withdrawEpochSharePrice && withdrawalReceipt) {
      const sharesAmount = withdrawalReceipt.shares;
      await lpContractCall({
        method: lpContract.completeWithdraw,
        args: [sharesAmount],
      });
      setListeningForWithdrawComplete(true);
    }
  };

  // Coordinate the interactions on submit
  const handleSubmit = async () => {
    try {
      if (account && lpContract && usdcContract) {
        if (mode === Mode.DEPOSIT) {
          if (depositMode === DepositMode.USDC) {
            await handleDepositCollateral();
          } else if (depositMode === DepositMode.REDEEM) {
            await handleRedeemShares();
          }
        } else if (mode === Mode.WITHDRAW) {
          if (withdrawMode === WithdrawMode.INITIATE) {
            await handleInitiateWithdraw();
          } else if (withdrawMode === WithdrawMode.COMPLETE) {
            await handleCompleteWithdraw();
          }
        }
        await getBalance(account);
        setInputValue("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const approveIsDisabled = !inputValue || approvalState;
  const depositIsDisabled =
    mode === Mode.DEPOSIT &&
    depositMode === DepositMode.USDC &&
    !(inputValue && account && approvalState);
  const completeWithdrawIsDisabled = !(
    withdrawalReceipt &&
    !withdrawalReceipt.shares.isZero() &&
    withdrawEpochSharePrice &&
    withdrawEpochSharePrice?._hex !== ZERO_UINT_256
  );

  return (
    <div className="flex-col items-center justify-between h-full">
      <div className="px-4 py-4 border-b-2 border-black flex items-center justify-end">
        <div className="w-fit h-full flex items-center">
          <UserPosition />
        </div>
      </div>
      <div className="flex border-b-2 border-black">
        <div className="border-r-2 border-b-2 border-black w-16 flex justify-center items-center">
          <div className="w-7 h-7 rounded-full border-black border-2 flex justify-center items-center">
            <div className="w-4 h-4 rounded-full border-black border-2" />
          </div>
        </div>
        <div className="w-full">
          <div className="w-full">
            <div className="w-full border-b-2 border-black">
              <div className="w-fit">
                <RadioButtonSlider
                  selected={mode}
                  setSelected={setMode}
                  options={[
                    {
                      key: Mode.DEPOSIT,
                      label: "Deposit",
                      value: Mode.DEPOSIT,
                    },
                    {
                      key: Mode.WITHDRAW,
                      label: "Withdraw",
                      value: Mode.WITHDRAW,
                      disabled:
                        redeemedShares?._hex === ZERO_UINT_256 &&
                        unredeemedShares?._hex === ZERO_UINT_256,
                      disabledTooltip: "You have no shares to withdraw",
                    },
                  ]}
                />
              </div>
            </div>
            <div className="w-full border-b-2 border-black">
              <div className="w-fit">
                {mode === Mode.DEPOSIT ? (
                  <RadioButtonSlider
                    selected={depositMode}
                    setSelected={setDepositMode}
                    buttonType="secondary"
                    options={[
                      {
                        key: DepositMode.USDC,
                        label: "1. Deposit USDC",
                        value: DepositMode.USDC,
                      },
                      {
                        key: DepositMode.REDEEM,
                        label: "2. Redeem Shares",
                        value: DepositMode.REDEEM,
                        disabled:
                          !unredeemedShares ||
                          unredeemedShares._hex === ZERO_UINT_256,
                        disabledTooltip: "You have no unredeemed shares",
                      },
                    ]}
                  />
                ) : (
                  <RadioButtonSlider
                    selected={withdrawMode}
                    setSelected={setWithrawMode}
                    buttonType="secondary"
                    options={[
                      {
                        key: WithdrawMode.INITIATE,
                        label: "1. Initiate",
                        value: WithdrawMode.INITIATE,
                        disabled:
                          !!withdrawalReceipt &&
                          withdrawalReceipt.shares._hex !== ZERO_UINT_256,
                        disabledTooltip:
                          "There is already an active withdrawal",
                      },
                      {
                        key: WithdrawMode.COMPLETE,
                        label: "2. Complete",
                        value: WithdrawMode.COMPLETE,
                      },
                    ]}
                  />
                )}
              </div>
            </div>

            <div className="p-4 flex justify-between items-center">
              {mode === Mode.DEPOSIT ? (
                depositMode === DepositMode.USDC ? (
                  <>
                    <h5>USDC:</h5>
                    <div className="flex items-center h-[36px]">
                      <RequiresWalletConnection className="w-[120px] h-6 mr-2">
                        {
                          <h5 className="mr-2">
                            <b>
                              {unredeemableCollateral
                                ? unredeemableCollateral
                                    .div(BIG_NUMBER_DECIMALS.USDC)
                                    .toString()
                                : "0"}{" "}
                              USDC
                            </b>
                          </h5>
                        }
                        {unredeemableCollateral &&
                          unredeemableCollateral?._hex !== ZERO_UINT_256 && (
                            <div className="rounded-full bg-green-600 h-2 w-2 relative cursor-pointer group mr-2">
                              <div className="absolute p-2 top-4 bg-bone border-2 border-black right-0 z-10 w-[320px] hidden group-hover:block">
                                {/* TODO(HC): Determine what this copy should be. */}
                                <p>
                                  Your USDC will be available to redeem as
                                  shares during our weekly strategy every Friday
                                  at 11am UTC
                                </p>
                              </div>
                            </div>
                          )}
                        {unredeemedShares &&
                          unredeemedShares?._hex !== ZERO_UINT_256 && (
                            <div className="rounded-full bg-yellow-600 h-2 w-2 relative cursor-pointer group">
                              <div className="absolute p-2 top-4 bg-bone border-2 border-black right-0 z-10 w-[320px] hidden group-hover:block">
                                {/* TODO(HC): Determine what this copy should be. */}
                                <p>You have some shares available to redeem.</p>
                              </div>
                            </div>
                          )}
                      </RequiresWalletConnection>{" "}
                    </div>
                  </>
                ) : (
                  <>
                    <h5>Shares:</h5>
                    <div className="flex items-center h-[36px]">
                      <RequiresWalletConnection className="w-[120px] h-6 mr-2">
                        <h5 className="mr-2">
                          <b>
                            {unredeemedShares
                              ?.div(BIG_NUMBER_DECIMALS.RYSK)
                              .toString()}{" "}
                            RYSK
                          </b>
                        </h5>
                      </RequiresWalletConnection>{" "}
                    </div>
                  </>
                )
              ) : withdrawMode === WithdrawMode.INITIATE ? (
                <>
                  <h5>Shares:</h5>
                  <div className="flex items-center h-[36px]">
                    <RequiresWalletConnection className="w-[120px] h-6 mr-2">
                      {unredeemedShares && redeemedShares && (
                        <>
                          <h5 className="mr-2">
                            <b>
                              {redeemedShares
                                ?.add(unredeemedShares)
                                .div(BIG_NUMBER_DECIMALS.RYSK)
                                .toString()}{" "}
                              RYSK
                            </b>
                          </h5>
                          {unredeemedShares._hex !== ZERO_UINT_256 &&
                            redeemedShares._hex !== ZERO_UINT_256 && (
                              <div className="rounded-full bg-green-600 h-2 w-2 relative cursor-pointer group">
                                <div className="absolute p-2 top-4 bg-bone border-2 border-black right-0 z-10 w-[320px] hidden group-hover:block">
                                  {/* TODO(HC): Determine what this copy should be. */}
                                  <p>
                                    This is the sum of your redeemed and
                                    unredeemed shares
                                  </p>
                                </div>
                              </div>
                            )}
                        </>
                      )}
                    </RequiresWalletConnection>{" "}
                  </div>
                </>
              ) : (
                <>
                  <h5>Collateral:</h5>
                  <div className="flex items-center h-[36px]">
                    <RequiresWalletConnection className="w-[120px] h-6 mr-2">
                      <>
                        <h5 className="mr-2">
                          <b>
                            {/* TODO(HC): Scale this properly once sharePrice being returned by oracle is more accurate. */}
                            {withdrawalReceipt &&
                              withdrawEpochSharePrice &&
                              withdrawalReceipt.shares
                                .div(BIG_NUMBER_DECIMALS.RYSK)
                                .mul(
                                  withdrawEpochSharePrice.div(
                                    BIG_NUMBER_DECIMALS.RYSK
                                  )
                                )
                                .toString()}{" "}
                            USDC
                          </b>
                        </h5>
                        {withdrawalReceipt &&
                          withdrawEpochSharePrice &&
                          withdrawEpochSharePrice?._hex === ZERO_UINT_256 && (
                            <div className="rounded-full bg-green-500 h-2 w-2 relative cursor-pointer group">
                              <div className="absolute p-2 top-4 bg-bone border-2 border-black right-0 z-10 w-[320px] hidden group-hover:block">
                                <p>
                                  Your shares will be available to withdraw as
                                  collateral during our weekly strategy every
                                  Friday at 11am UTC
                                </p>
                              </div>
                            </div>
                          )}
                      </>
                    </RequiresWalletConnection>{" "}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="ml-[-2px]">
            {!(
              mode === Mode.WITHDRAW && withdrawMode === WithdrawMode.COMPLETE
            ) ? (
              <TextInput
                className="text-right p-4 text-xl border-r-0"
                setValue={handleInputChange}
                value={inputValue}
                iconLeft={
                  <div className="h-full flex items-center px-4 text-right text-gray-600">
                    <p>
                      {mode === Mode.DEPOSIT
                        ? depositMode === DepositMode.USDC
                          ? "USDC"
                          : "Shares"
                        : withdrawMode === WithdrawMode.INITIATE
                        ? "Shares"
                        : "USDC"}
                    </p>
                  </div>
                }
                numericOnly
              />
            ) : (
              <div className="border-b-2 border-black w-full" />
            )}
          </div>
        </div>
      </div>
      <div className="flex">
        {mode === Mode.DEPOSIT ? (
          depositMode === DepositMode.USDC ? (
            // Deposit
            <>
              <button
                onClick={handleApproveSpend}
                className={`w-full py-6 bg-black text-white mt-[-2px] ${
                  approveIsDisabled ? "!bg-gray-300" : ""
                }`}
              >
                {`${approvalState ? "Approved ✅" : "Approve"}`}
              </button>
              <button
                onClick={() => {
                  if (inputValue) {
                    handleSubmit();
                  }
                }}
                className={`w-full py-6 bg-black text-white mt-[-2px] ${
                  depositIsDisabled ? "!bg-gray-300" : ""
                }`}
                disabled={!(inputValue && account)}
              >
                Deposit
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                if (inputValue) {
                  handleSubmit();
                }
              }}
              className={`w-full py-6 bg-black text-white mt-[-2px] ${
                !(inputValue && account) ? "!bg-gray-300" : ""
              }`}
              disabled={!(inputValue && account)}
            >
              Redeem
            </button>
          )
        ) : withdrawMode === WithdrawMode.INITIATE ? (
          <button
            onClick={() => {
              if (inputValue) {
                handleSubmit();
              }
            }}
            className={`w-full py-6 bg-black text-white mt-[-2px] ${
              !(inputValue && account) ? "bg-gray-300 cursor-default" : ""
            }`}
          >
            Initiate withdrawal
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className={`w-full py-6 bg-black text-white mt-[-2px] ${
              completeWithdrawIsDisabled ? "!bg-gray-300 cursor-default" : ""
            }`}
            disabled={completeWithdrawIsDisabled}
          >
            Complete withdrawal
          </button>
        )}
      </div>
    </div>
  );
};
