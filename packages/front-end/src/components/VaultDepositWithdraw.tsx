import React, { useCallback, useEffect, useState } from "react";
import { useContract } from "../hooks/useContract";
import { Button } from "./shared/Button";
import { TextInput } from "./shared/TextInput";

enum Mode {
  DEPOSIT,
  WITHDRAW,
}

export const VaultDepositWithdraw = () => {
  const [mode, setMode] = useState<Mode>(Mode.DEPOSIT);

  const [balance, setBalance] = useState<string | null>(null);

  const [inputValue, setInputValue] = useState("");

  // TODO(HC): use useContract hook here to get LP contract object.

  const getBalance = useCallback(async () => {
    // TODO(HC): Call balance method on contract here.
  }, []);

  useEffect(() => {
    (async () => {
      await getBalance();
    })();
  }, [getBalance]);

  const handleSubmit = async () => {
    // TODO(HC): Call deposit and withdraw methods on contract
    // + fetch latest balance.
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
        setValue={setInputValue}
        value={inputValue}
        className="mb-4"
        numericOnly
      />
      <Button onClick={() => handleSubmit()} className="w-full">
        Submit
      </Button>
    </div>
  );
};
