import React, { useState } from "react";
import { Button } from "./Button";
import { TextInput } from "./TextInput";

enum Mode {
  DEPOSIT,
  WITHDRAW,
}

export const VaultDepositWithdraw = () => {
  const [mode, setMode] = useState<Mode>(Mode.DEPOSIT);

  return (
    <div className="flex-col items-center">
      <div className="w-full flex justify-between mb-8">
        <Button onClick={() => setMode(Mode.DEPOSIT)}>Deposit</Button>
        <Button onClick={() => setMode(Mode.WITHDRAW)}>Withdraw</Button>
      </div>
      <TextInput placeholder="Amount" />
    </div>
  );
};
