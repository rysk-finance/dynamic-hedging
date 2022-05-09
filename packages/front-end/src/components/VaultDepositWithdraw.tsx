import { BigNumber, ethers } from "ethers";
import React, { useCallback, useEffect, useState } from "react";
import ERC20ABI from "../abis/erc20.json";
import { useWalletContext } from "../App";
import LPABI from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json";
import { MAX_UINT_256 } from "../config/constants";
import { USDC_ADDRESS } from "../config/mainnetContracts";
import addresses from "../contracts.json";
import { useContract } from "../hooks/useContract";
import { useGlobalContext } from "../state/GlobalContext";
import { RequiresWalletConnection } from "./RequiresWalletConnection";
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

  const [balance, setBalance] = useState<string | null>(null);

  const [inputValue, setInputValue] = useState("");

  const [lpContract] = useContract({
    address: addresses.localhost.liquidityPool,
    ABI: LPABI.abi,
    readOnly: false,
  });

  const [usdcContract] = useContract({
    address: USDC_ADDRESS,
    ABI: ERC20ABI,
    readOnly: false,
  });

  const getBalance = useCallback(
    async (address: string) => {
      const balance = await lpContract?.balanceOf(address);
      const parsedBalance = ethers.utils.formatUnits(balance, 18);
      setBalance(parsedBalance ?? null);
    },
    [lpContract]
  );

  useEffect(() => {
    (async () => {
      if (account) {
        await getBalance(account);
      }
    })();
  }, [getBalance, account]);

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
            const approvalTransaction = await usdcContract.approve(
              addresses.localhost.liquidityPool,
              settings.unlimitedApproval
                ? ethers.BigNumber.from(MAX_UINT_256)
                : amount
            );
            await approvalTransaction.wait();
          }
          const depositTransaction = await lpContract.deposit(amount, account);
          await depositTransaction.wait();
        } else if (mode === Mode.WITHDRAW) {
          const amount = ethers.utils.parseUnits(inputValue, 18);
          const withdrawTransaction = await lpContract.withdraw(
            amount,
            account
          );
          await withdrawTransaction.wait();
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
            <div className="p-4 flex justify-between border-b-2 border-black">
              <h4>Balance:</h4>
              <div className="flex">
                <h4 className="mr-2">
                  <RequiresWalletConnection className="w-[120px]">
                    {balance?.toString()}
                  </RequiresWalletConnection>{" "}
                </h4>
                <h4>USDC</h4>
              </div>
            </div>
            <div className="w-fit">
              <RadioButtonSlider
                selected={mode}
                setSelected={setMode}
                options={[
                  { key: Mode.DEPOSIT, label: "Deposit", value: Mode.DEPOSIT },
                  {
                    key: Mode.WITHDRAW,
                    label: "Withdraw",
                    value: Mode.WITHDRAW,
                  },
                ]}
              />
            </div>
          </div>
          <div className="ml-[-2px]">
            <TextInput
              className="text-right p-4 text-xl"
              setValue={setInputValue}
              value={inputValue}
              iconLeft={
                <div className="h-full flex items-center px-4 text-right text-gray-600">
                  <p>USDC</p>
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
