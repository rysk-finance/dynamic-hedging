import React from "react";
import { BigNumber, ethers } from "ethers";
import { useCallback, useEffect, useState } from "react";
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
import { useGlobalContext } from "../state/GlobalContext";
import {
  ContractAddresses,
  DepositReceipt,
  ETHNetwork,
  Events,
} from "../types";
import { RequiresWalletConnection } from "./RequiresWalletConnection";
import { Button } from "./shared/Button";
import { TextInput } from "./shared/TextInput";

enum DepositMode {
  USDC = "USDC",
  REDEEM = "Redeem",
}

export const VaultDeposit = () => {
  const { account, network } = useWalletContext();

  const {
    state: { settings },
  } = useGlobalContext();

  // UI State
  const [depositMode, setDepositMode] = useState<DepositMode>(DepositMode.USDC);
  const [inputValue, setInputValue] = useState("");
  const [listeningForApproval, setListeningForApproval] = useState(false);
  const [listeningForDeposit, setListeningForDeposit] = useState(false);
  const [listeningForRedeem, setListeningForRedeem] = useState(false);

  // Chain state
  const [redeemedShares, setRedeemedShares] = useState<BigNumber | null>(null);
  const [unredeemableCollateral, setUnredeemableCollateral] =
    useState<BigNumber | null>(null);
  const [unredeemedShares, setUnredeemedShares] = useState<BigNumber | null>(
    null
  );
  const [approvalState, setApprovalState] = useState<Events["Approval"] | null>(
    null
  );

  // Contracts
  const [lpContract, lpContractCall] = useContract<{
    EpochExecuted: [];
    Deposit: [BigNumber, BigNumber, BigNumber];
    Redeem: [];
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
    },
    isListening: {
      EpochExecuted: true,
      Deposit: listeningForDeposit,
      Redeem: listeningForRedeem,
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

  const epochListener = useCallback(async () => {
    updateDepositState();
  }, [updateDepositState]);

  useEffect(() => {
    (async () => {
      if (account) {
        await getBalance(account);
        await epochListener();
      }
    })();
  }, [getBalance, account, epochListener]);

  // Reset input value when switching mode
  useEffect(() => {
    setInputValue("");
  }, [depositMode]);

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
        (addresses as Record<ETHNetwork, ContractAddresses>)[network.name][
          "liquidityPool"
        ]
      )) as BigNumber;
      try {
        if (!settings.unlimitedApproval || approvedAmount.lt(amount)) {
          await usdcContractCall({
            method: usdcContract.approve,
            args: [
              (addresses as Record<ETHNetwork, ContractAddresses>)[
                network.name
              ]["liquidityPool"],
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

  // Coordinate the interactions on submit
  const handleSubmit = async () => {
    try {
      if (account && lpContract && usdcContract) {
        if (depositMode === DepositMode.USDC) {
          await handleDepositCollateral();
        } else if (depositMode === DepositMode.REDEEM) {
          await handleRedeemShares();
        }
        await getBalance(account);
        setInputValue("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const approveIsDisabled =
    !inputValue || !!approvalState || listeningForApproval;
  const depositIsDisabled =
    depositMode === DepositMode.USDC &&
    !(inputValue && account && approvalState);

  return (
    <div className="flex-col items-center justify-between h-full">
      <div className="w-full h-8 bg-black text-white px-2 flex items-center justify-start">
        <p>1. Deposit USDC</p>
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
                  500
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
                  <p>{depositMode === DepositMode.USDC ? "USDC" : "Shares"}</p>
                </div>
              }
              numericOnly
            />
          </div>
          <div className="ml-[-2px] p-2 border-b-[2px] border-black text-[16px]">
            <div className="flex justify-between mb-2">
              <p>Pending USDC</p>
              <p>
                <RequiresWalletConnection className="translate-y-[-6px] w-[80px] h-[12px]">
                  500
                </RequiresWalletConnection>{" "}
                USDC
              </p>
            </div>
            <div className="flex justify-between">
              <p>Deposited USDC</p>
              <p>
                <RequiresWalletConnection className="translate-y-[-6px] w-[80px] h-[12px]">
                  500
                </RequiresWalletConnection>{" "}
                USDC
              </p>
            </div>
          </div>
          <div className="flex">
            <>
              <Button
                onClick={handleApproveSpend}
                className={`w-full !py-6 !border-0 bg-black text-white`}
                disabled={approveIsDisabled}
                color="black"
              >
                {approvalState
                  ? "✅ Approved"
                  : listeningForApproval
                  ? "⏱ Awaiting Approval"
                  : "Approve"}
              </Button>
              <Button
                onClick={() => {
                  if (inputValue) {
                    handleSubmit();
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
            </>
          </div>
        </div>
      </div>
      <div>
        <div className="w-full h-8 bg-black text-white px-2 flex items-center justify-start">
          <p>2. Redeem</p>
        </div>
        <div className="p-2">
          <p className="text-xs">
            Your USDC will be available to redeem as shares during our weekly
            strategy every Friday at 11am UTC
          </p>
        </div>
      </div>
    </div>
  );
};
