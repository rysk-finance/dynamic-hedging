import React, { useCallback, useEffect, useState } from "react";
import DummyVaultABI from "../artifacts/contracts/DummyVault.sol/DummyVault.json";
import addresses from "../contracts.json";
import { useContract } from "../hooks/useContract";
import { Button } from "./Button";
import { TextInput } from "./TextInput";

enum Mode {
  DEPOSIT,
  WITHDRAW,
}

const vaultAddress = addresses.localhost.DummyVault;

export const VaultDepositWithdraw = () => {
  const [mode, setMode] = useState<Mode>(Mode.DEPOSIT);

  const [vaultContract] = useContract({
    address: vaultAddress,
    ABI: DummyVaultABI.abi,
    readOnly: false,
  });

  const [balance, setBalance] = useState<string | null>(null);

  const [inputValue, setInputValue] = useState("");

  const getBalance = useCallback(async () => {
    if (vaultContract) {
      const balance = await vaultContract.getBalance();
      setBalance(balance.toString());
    }
  }, [vaultContract]);

  useEffect(() => {
    (async () => {
      await getBalance();
    })();
  }, [getBalance]);

  const handleSubmit = async () => {
    const value = Number(inputValue);
    if (vaultContract) {
      if (mode === Mode.DEPOSIT) {
        await vaultContract.deposit(value);
      } else if (mode === Mode.WITHDRAW) {
        await vaultContract.withdraw(value);
      }
    }
    await getBalance();
  };

  return (
    <div className="flex-col items-center justify-between h-full">
      <div className="w-full flex justify-between mb-8">
        <Button onClick={() => setMode(Mode.DEPOSIT)}>Deposit</Button>
        <Button onClick={() => setMode(Mode.WITHDRAW)}>Withdraw</Button>
      </div>
      <h3>Balance: {balance}</h3>
      <TextInput
        placeholder="Amount"
        onChange={(e) => {
          setInputValue(e.target.value);
        }}
        value={inputValue}
        className="mb-4"
      />
      <Button onClick={() => handleSubmit()} className="w-full">
        Submit
      </Button>
    </div>
  );
};
