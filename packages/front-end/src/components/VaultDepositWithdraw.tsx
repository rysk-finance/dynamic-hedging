import React, { useCallback, useEffect, useState } from "react";
import { useWalletContext } from "../App";
import LPABI from "../artifacts/contracts/LiquidityPool.sol/LiquidityPool.json";
import { USDC_ADDRESS } from "../config/mainnetContracts";
import addresses from "../contracts.json";
import { useContract } from "../hooks/useContract";
import { Button } from "./shared/Button";
import { TextInput } from "./shared/TextInput";
import ERC20ABI from "../abis/erc20.json";
import { ethers } from "ethers";

enum Mode {
  DEPOSIT,
  WITHDRAW,
}

export const VaultDepositWithdraw = () => {
  const { account } = useWalletContext();

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
      const amount = ethers.utils.parseUnits(inputValue, 6);
      if (account && amount && lpContract && usdcContract) {
        // USDC is 6 decimals
        const approvalTransaction = await usdcContract.approve(
          addresses.localhost.liquidityPool,
          amount
        );
        console.log(approvalTransaction);
        await approvalTransaction.wait();
        console.log("done!");
        if (mode === Mode.DEPOSIT) {
          const depositTransaction = await lpContract.deposit(amount, account);
          console.log("started deposit transaction");
          await depositTransaction.wait();
          console.log("deposit complete!");
        } else if (mode === Mode.WITHDRAW) {
          const withdrawTransaction = await lpContract.withdraw(
            amount,
            account
          );
          console.log("started withdraw transaction");
          await withdrawTransaction.wait();
          console.log("withdraw complete!");
        }
        await getBalance(account);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-col items-center justify-between h-full">
      <div className="w-full flex justify-between mb-8">
        <Button onClick={() => setMode(Mode.DEPOSIT)}>Deposit</Button>
        <Button onClick={() => setMode(Mode.WITHDRAW)}>Withdraw</Button>
      </div>
      <h3>Balance: {balance?.toString()}</h3>
      <div className="mb-4">
        <TextInput
          className="text-right"
          setValue={setInputValue}
          value={inputValue}
          iconLeft={
            <div className="h-full flex items-center px-2 text-right text-gray-600">
              <p>USDC</p>
            </div>
          }
          numericOnly
        />
      </div>
      <Button onClick={() => handleSubmit()} className="w-full">
        Submit
      </Button>
    </div>
  );
};
