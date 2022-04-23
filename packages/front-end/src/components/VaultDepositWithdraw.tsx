import { contractsContextFactory, useEthersContext } from "eth-hooks/context";
import React, { useEffect, useState } from "react";
import { Button } from "./Button";
import { TextInput } from "./TextInput";
import addresses from "../contracts.json";
import * as ethers from "ethers";
import DummyVaultABI from "../artifacts/contracts/DummyVault.sol/DummyVault.json";
import { DummyVault } from "../types/DummyVault";
import { useWalletContext } from "../App";

enum Mode {
  DEPOSIT,
  WITHDRAW,
}

const dummyVaultAddress = addresses.localhost.DummyVault;

export const VaultDepositWithdraw = () => {
  const { provider } = useWalletContext();

  const [dummyVaultContract, setDummyVaultContract] =
    useState<ethers.ethers.Contract | null>(null);

  const [mode, setMode] = useState<Mode>(Mode.DEPOSIT);

  const test = async () => {
    if (provider) {
      const contract = new ethers.Contract(
        dummyVaultAddress,
        DummyVaultABI.abi,
        provider
      );
      debugger;
      const a = await contract.getBalance();
      setDummyVaultContract(contract);
    }
  };

  return (
    <div className="flex-col items-center">
      <div className="w-full flex justify-between mb-8">
        <Button onClick={() => setMode(Mode.DEPOSIT)}>Deposit</Button>
        <Button onClick={() => setMode(Mode.WITHDRAW)}>Withdraw</Button>
        <Button onClick={() => test()}>test</Button>
      </div>
      <TextInput placeholder="Amount" />
    </div>
  );
};
