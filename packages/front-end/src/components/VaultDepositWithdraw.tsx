import { BigNumber, ethers } from "ethers";
import React, { useCallback, useEffect, useState } from "react";
import ERC20ABI from "../abis/erc20.json";
import { useWalletContext } from "../App";
import LPABI from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json";
import {
  BIG_NUMBER_DECIMALS,
  DECIMALS,
  MAX_UINT_256,
  ZERO_UINT_256,
} from "../config/constants";
import { USDC_ADDRESS } from "../config/mainnetContracts";
import addresses from "../contracts.json";
import { useContract } from "../hooks/useContract";
import { useGlobalContext } from "../state/GlobalContext";
import { DepositReceipt, WithdrawalReceipt } from "../types";
import { RequiresWalletConnection } from "./RequiresWalletConnection";
import { Button } from "./shared/Button";
import { RadioButtonSlider } from "./shared/RadioButtonSlider";
import { TextInput } from "./shared/TextInput";

enum Mode {
  DEPOSIT = "Deposit",
  WITHDRAW = "Withdraw",
}

enum DepositMode {
  COLLATERAL = "Collateral",
  REDEEM = "Redeem",
}

enum WithdrawMode {
  INITIATE = "Initiate",
  COMPLETE = "Complete",
}

export const VaultDepositWithdraw = () => {
  const { account } = useWalletContext();

  const {
    state: { settings },
  } = useGlobalContext();

  const [mode, setMode] = useState<Mode>(Mode.DEPOSIT);
  const [depositMode, setDepositMode] = useState<DepositMode>(
    DepositMode.COLLATERAL
  );
  const [withdrawMode, setWithrawMode] = useState<WithdrawMode>(
    WithdrawMode.INITIATE
  );

  const [currentEpoch, setCurrentEpoch] = useState<null | BigNumber>(null);
  const [unredeemableCollateral, setUnredeemableCollateral] =
    useState<BigNumber | null>(null);
  const [redeemedShares, setRedeemedShares] = useState<BigNumber | null>(null);
  const [unredeemedShares, setUnredeemedShares] = useState<BigNumber | null>(
    null
  );
  const [withdrawalReceipt, setwithdrawalReceipt] =
    useState<WithdrawalReceipt | null>(null);
  const [withdrawEpochSharePrice, setWithdrawEpochSharePrice] =
    useState<BigNumber | null>(null);

  const [inputValue, setInputValue] = useState("");

  const [lpContract, lpContractCall] = useContract({
    address: addresses.localhost.liquidityPool,
    ABI: LPABI.abi,
    readOnly: false,
  });

  const epochListener = useCallback(async () => {
    if (lpContract && account) {
      // Deposit logic
      const depositReceipt: DepositReceipt = await lpContract.depositReceipts(
        account
      );
      const currentEpoch: BigNumber = await lpContract.epoch();
      setCurrentEpoch(currentEpoch);
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

        // Withdraw logic
        const withdrawalReceipt: WithdrawalReceipt =
          await lpContract.withdrawalReceipts(account);
        const withdrawSharePrice = await lpContract.epochPricePerShare(
          withdrawalReceipt.epoch
        );
        setWithdrawEpochSharePrice(withdrawSharePrice);
      }
    }
  }, [lpContract, account]);

  const [usdcContract, usdcContractCall] = useContract({
    address: USDC_ADDRESS,
    ABI: ERC20ABI,
    readOnly: false,
  });

  const getBalance = useCallback(
    async (address: string) => {
      const balance = await lpContract?.balanceOf(address);
      setRedeemedShares(balance);
    },
    [lpContract]
  );

  const getSharesPendingWithdrawal = useCallback(async () => {
    if (lpContract && account) {
      const receipt: WithdrawalReceipt = await lpContract.withdrawalReceipts(
        account
      );
      setwithdrawalReceipt(receipt);
    }
  }, [lpContract, account]);

  useEffect(() => {
    (async () => {
      if (account) {
        await getBalance(account);
      }
    })();
  }, [getBalance, account]);

  // Attatch event listeners
  useEffect(() => {
    lpContract?.on("EpochExecuted", epochListener);
    epochListener();

    lpContract?.on("InitiateWithdraw", getSharesPendingWithdrawal);
    getSharesPendingWithdrawal();

    return () => {
      lpContract?.off("EpochExecuted", epochListener);
      lpContract?.off("InitiateWithdraw", getSharesPendingWithdrawal);
    };
  }, [lpContract, getSharesPendingWithdrawal, epochListener]);

  useEffect(() => {
    setDepositMode(DepositMode.COLLATERAL);
    setWithrawMode(WithdrawMode.INITIATE);
    setInputValue("");
  }, [mode]);

  useEffect(() => {
    setInputValue("");
  }, [mode, depositMode, withdrawMode]);

  const handleDepositCollateral = async () => {
    if (usdcContract && lpContract && account) {
      const amount = ethers.utils.parseUnits(inputValue, DECIMALS.USDC);
      const approvedAmount = (await usdcContract.allowance(
        account,
        addresses.localhost.liquidityPool
      )) as BigNumber;
      if (!settings.unlimitedApproval || approvedAmount.lt(amount)) {
        await usdcContractCall(
          usdcContract.approve,
          addresses.localhost.liquidityPool,
          settings.unlimitedApproval
            ? ethers.BigNumber.from(MAX_UINT_256)
            : amount
        );
      }
      await lpContractCall(lpContract.deposit, amount);
    }
  };

  const handleRedeemShares = async () => {
    if (lpContract) {
      const amount = ethers.utils.parseUnits(inputValue, DECIMALS.RYSK);
      await lpContractCall(lpContract.redeem, amount);
    }
  };

  const handleInitiateWithdraw = async () => {
    if (lpContract) {
      const amount = ethers.utils.parseUnits(inputValue, DECIMALS.RYSK);
      await lpContractCall(lpContract.initiateWithdraw, amount);
    }
  };

  const handleCompleteWithdraw = async () => {
    if (lpContract && withdrawEpochSharePrice) {
      // console.log(withdrawalReceipt);
      const usdcAmount = ethers.utils.parseUnits(inputValue, DECIMALS.USDC);
      const sharesAmount = usdcAmount
        .div(
          withdrawEpochSharePrice
            .div(BIG_NUMBER_DECIMALS.RYSK)
            .mul(BIG_NUMBER_DECIMALS.USDC)
        )
        .mul(BIG_NUMBER_DECIMALS.RYSK);
      await lpContractCall(lpContract.completeWithdraw, sharesAmount);
    }
  };

  const handleSubmit = async () => {
    try {
      if (account && lpContract && usdcContract) {
        if (mode === Mode.DEPOSIT) {
          if (depositMode === DepositMode.COLLATERAL) {
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

  return (
    <div className="flex-col items-center justify-between h-full">
      <div className="px-4 py-2 border-b-2 border-black flex items-center justify-between">
        <div className="w-fit h-full flex items-center font-parabole ">
          <h3 className="">Rysk Vault</h3>
        </div>
        <div className="w-fit h-full flex items-center">
          <h4 className="">
            <b>
              Shares: {redeemedShares?.div(BIG_NUMBER_DECIMALS.RYSK).toString()}
            </b>
          </h4>
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
                        key: DepositMode.COLLATERAL,
                        label: "1. Deposit Collateral",
                        value: DepositMode.COLLATERAL,
                      },
                      {
                        key: DepositMode.REDEEM,
                        label: "2. Redeem Shares",
                        value: DepositMode.REDEEM,
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
                depositMode === DepositMode.COLLATERAL ? (
                  <>
                    <h4>Collateral:</h4>
                    <div className="flex items-center h-[36px]">
                      <RequiresWalletConnection className="w-[120px] h-6 mr-2">
                        {
                          <h4 className="mr-2">
                            {unredeemableCollateral
                              ? unredeemableCollateral
                                  .div(BIG_NUMBER_DECIMALS.USDC)
                                  .toString()
                              : "0"}{" "}
                            USDC
                          </h4>
                        }
                        {unredeemableCollateral &&
                          unredeemableCollateral?._hex !== ZERO_UINT_256 && (
                            <div className="rounded-full bg-green-600 h-2 w-2 relative cursor-pointer group mr-2">
                              <div className="absolute p-2 top-4 bg-bone border-2 border-black right-0 z-10 w-[320px] hidden group-hover:block">
                                {/* TODO(HC): Determine what this copy should be. */}
                                <p>
                                  Your collateral will be availale to redeem as
                                  shares during our weekly strategy every Friday
                                  at 11am UTC
                                </p>
                              </div>
                            </div>
                          )}
                        {unredeemedShares?._hex !== ZERO_UINT_256 && (
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
                    <h4>Shares:</h4>
                    <div className="flex items-center h-[36px]">
                      <RequiresWalletConnection className="w-[120px] h-6 mr-2">
                        <h4 className="mr-2">
                          {unredeemedShares
                            ?.div(BIG_NUMBER_DECIMALS.RYSK)
                            .toString()}
                        </h4>
                      </RequiresWalletConnection>{" "}
                    </div>
                  </>
                )
              ) : withdrawMode === WithdrawMode.INITIATE ? (
                <>
                  <h4>Shares:</h4>
                  <div className="flex items-center h-[36px]">
                    <RequiresWalletConnection className="w-[120px] h-6 mr-2">
                      {unredeemedShares && redeemedShares && (
                        <>
                          <h4 className="mr-2">
                            {redeemedShares
                              ?.add(unredeemedShares)
                              .div(BIG_NUMBER_DECIMALS.RYSK)
                              .toString()}
                          </h4>
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
                  <h4>Collateral:</h4>
                  <div className="flex items-center h-[36px]">
                    <RequiresWalletConnection className="w-[120px] h-6 mr-2">
                      {withdrawalReceipt &&
                        (withdrawEpochSharePrice &&
                        withdrawEpochSharePrice?._hex !== ZERO_UINT_256 ? (
                          <>
                            <h4 className="mr-2">
                              {/* TODO(HC): Scale this properly once sharePrice being returned by oracle is more accurate. */}
                              {withdrawalReceipt.shares
                                .div(BIG_NUMBER_DECIMALS.RYSK)
                                .mul(
                                  withdrawEpochSharePrice.div(
                                    BIG_NUMBER_DECIMALS.RYSK
                                  )
                                )
                                .toString()}{" "}
                              USDC
                            </h4>
                          </>
                        ) : (
                          <>
                            <h4 className="mr-2">0 USDC</h4>
                            <div className="rounded-full bg-red-500 h-2 w-2 relative cursor-pointer group">
                              <div className="absolute p-2 top-4 bg-bone border-2 border-black right-0 z-10 w-[320px] hidden group-hover:block">
                                <p>
                                  Your shares will be available to withdraw as
                                  collateral during our weekly strategy every
                                  Friday at 11am UTC
                                </p>
                              </div>
                            </div>
                          </>
                        ))}
                    </RequiresWalletConnection>{" "}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="ml-[-2px]">
            <TextInput
              className="text-right p-4 text-xl"
              setValue={setInputValue}
              value={inputValue}
              iconLeft={
                <div className="h-full flex items-center px-4 text-right text-gray-600">
                  <p>
                    {mode === Mode.DEPOSIT
                      ? depositMode === DepositMode.COLLATERAL
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
          </div>
        </div>
      </div>
      <button
        onClick={() => {
          if (inputValue) {
            handleSubmit();
          }
        }}
        className={`w-full py-6 rounded-b-xl bg-black text-white mt-[-2px] ${
          inputValue && account ? "" : "bg-gray-300 cursor-default"
        }`}
      >
        {mode === Mode.DEPOSIT
          ? depositMode === DepositMode.COLLATERAL
            ? "Deposit"
            : "Redeem"
          : withdrawMode === WithdrawMode.INITIATE
          ? "Initiate withdrawal"
          : "Complete withdrawal"}
      </button>
    </div>
  );
};
