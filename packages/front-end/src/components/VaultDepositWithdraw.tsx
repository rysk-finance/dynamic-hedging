import { BigNumber, ethers } from "ethers";
import React, { useCallback, useEffect, useState } from "react";
import ERC20ABI from "../abis/erc20.json";
import { useWalletContext } from "../App";
import LPABI from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json";
import {
  BIG_NUMBER_DECIMALS,
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

export const VaultDepositWithdraw = () => {
  const { account } = useWalletContext();

  const {
    state: { settings },
  } = useGlobalContext();

  const [mode, setMode] = useState<Mode>(Mode.DEPOSIT);

  const [currentEpoch, setCurrentEpoch] = useState<null | BigNumber>(null);
  const [unredeemableCollateral, setUnredeemableCollateral] =
    useState<BigNumber | null>(null);
  const [redeemedShares, setRedeemedShares] = useState<string | null>(null);
  const [unredeemedShares, setUnredeemedShares] = useState<BigNumber | null>(
    null
  );
  const [withdrawlReceipt, setWithdrawlReceipt] =
    useState<WithdrawalReceipt | null>(null);

  const [inputValue, setInputValue] = useState("");

  const [lpContract, lpContractCall] = useContract({
    address: addresses.localhost.liquidityPool,
    ABI: LPABI.abi,
    readOnly: false,
  });

  const epochListener = useCallback(async () => {
    if (lpContract && account) {
      const receipt: DepositReceipt = await lpContract.depositReceipts(account);
      const currentEpoch: BigNumber = await lpContract.epoch();
      setCurrentEpoch(currentEpoch);
      const previousUnredeemedShares = receipt.unredeemedShares.div(
        BIG_NUMBER_DECIMALS.RYSK
      );
      // If true, the share price for the most recent deposit hasn't been calculated
      // so we can only show the collateral balance, not the equivalent number of shares.
      if (currentEpoch._hex === receipt.epoch._hex) {
        setUnredeemedShares(previousUnredeemedShares);
        if (receipt.amount.toNumber() !== 0) {
          setUnredeemableCollateral(receipt.amount);
        }
      } else {
        setUnredeemableCollateral(null);
        const pricePerShareAtEpoch: BigNumber =
          await lpContract.epochPricePerShare(receipt.epoch);
        const newUnredeemedShares = receipt.amount
          .mul(BIG_NUMBER_DECIMALS.RYSK.div(BIG_NUMBER_DECIMALS.USDC))
          .div(pricePerShareAtEpoch);
        const sharesToRedeem =
          previousUnredeemedShares.add(newUnredeemedShares);
        setUnredeemedShares(sharesToRedeem);
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
      const parsedBalance = ethers.utils.formatUnits(balance, 18);
      setRedeemedShares(parsedBalance ?? null);
    },
    [lpContract]
  );

  const getSharesPendingWithdrawal = useCallback(async () => {
    if (lpContract && account) {
      const receipt: WithdrawalReceipt = await lpContract.withdrawalReceipts(
        account
      );
      setWithdrawlReceipt(receipt);
    }
  }, [lpContract, account]);

  const redeemShares = useCallback(async () => {
    // TODO(HC): Make number of shares to redeem a param once UI is figured out.
    if (lpContract) {
      await lpContractCall(lpContract.redeem, BigNumber.from(MAX_UINT_256));
    }
  }, [lpContract, lpContractCall]);

  const completeWithdrawal = useCallback(async () => {
    // TODO(HC): Does this also need to take number of shares as an input
    if (lpContract) {
      await lpContractCall(
        lpContract.completeWithdraw,
        BigNumber.from(MAX_UINT_256)
      );
      await getSharesPendingWithdrawal();
    }
  }, [lpContract, lpContractCall, getSharesPendingWithdrawal]);

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

  const handleSubmit = async () => {
    try {
      if (account && lpContract && usdcContract) {
        if (mode === Mode.DEPOSIT) {
          const amount = ethers.utils.parseUnits(inputValue, 6);
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
        } else if (mode === Mode.WITHDRAW) {
          const amount = ethers.utils.parseUnits(inputValue, 18);
          await lpContractCall(lpContract.initiateWithdraw, amount);
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
      <div className="font-parabole">
        <h3 className="pl-4 py-2 border-b-2 border-black">Rysk Vault</h3>
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

            <div className="p-4 flex justify-between border-b-2 border-black">
              <h4>Shares:</h4>
              <div className="flex">
                <h4 className="mr-2">
                  <RequiresWalletConnection className="w-[120px]">
                    {redeemedShares?.toString()}
                  </RequiresWalletConnection>{" "}
                </h4>
              </div>
            </div>

            <div className="p-4 flex justify-between items-center">
              {mode === Mode.DEPOSIT ? (
                <>
                  <h4>Redeemable Shares:</h4>
                  <div className="flex items-center h-[36px]">
                    <RequiresWalletConnection className="w-[120px] h-6 mr-2">
                      {unredeemedShares && unredeemedShares.toNumber() !== 0 && (
                        <Button
                          className="mr-4"
                          onClick={() => {
                            redeemShares();
                          }}
                        >
                          Redeem
                        </Button>
                      )}
                      <h4 className="mr-2">{unredeemedShares?.toString()}</h4>
                      {unredeemableCollateral && (
                        <div className="rounded-full bg-red-500 h-2 w-2 relative cursor-pointer group">
                          <div className="absolute p-2 top-4 bg-bone border-2 border-black right-0 z-10 w-[320px] hidden group-hover:block">
                            {/* TODO(HC): Determine what this copy should be. */}
                            <p>
                              Your collateral of{" "}
                              <b>
                                {unredeemableCollateral
                                  ?.div(BIG_NUMBER_DECIMALS.USDC)
                                  .toString()}
                                {" USDC "}
                              </b>
                              has been recieved and will be available to redeem
                              shortly.
                            </p>
                          </div>
                        </div>
                      )}
                    </RequiresWalletConnection>{" "}
                  </div>
                </>
              ) : (
                <>
                  <h4>Pending Withdrawal:</h4>
                  <div className="flex items-center h-[36px]">
                    <RequiresWalletConnection className="w-[120px] h-6 mr-2">
                      {currentEpoch &&
                        !withdrawlReceipt?.epoch.eq(currentEpoch) &&
                        withdrawlReceipt?.shares._hex !== ZERO_UINT_256 && (
                          <Button
                            className="mr-4"
                            onClick={() => {
                              completeWithdrawal();
                            }}
                          >
                            Complete
                          </Button>
                        )}
                      <h4 className="mr-2">
                        {withdrawlReceipt?.shares
                          .div(BIG_NUMBER_DECIMALS.RYSK)
                          .toString()}
                      </h4>
                      {currentEpoch &&
                        withdrawlReceipt?.epoch.eq(currentEpoch) && (
                          <div className="rounded-full bg-red-500 h-2 w-2 relative cursor-pointer group">
                            <div className="absolute p-2 top-4 bg-bone border-2 border-black right-0 z-10 w-[320px] hidden group-hover:block">
                              <p>
                                Your collateral will be available to withdraw
                                shortly.
                              </p>
                            </div>
                          </div>
                        )}
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
                  <p>{mode === Mode.DEPOSIT ? "USDC" : "Shares"}</p>
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
        Submit
      </button>
    </div>
  );
};
