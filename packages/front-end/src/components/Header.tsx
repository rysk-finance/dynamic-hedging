import { useConnectWallet } from "@web3-onboard/react";
import React from "react";
import { useWalletContext } from "../App";
import { Button } from "./Button";

export const Header: React.FC = () => {
  const [{ wallet }] = useConnectWallet();
  const { connectWallet, provider } = useWalletContext();

  return (
    <div className="fixed w-full h-16 t-0 flex items-center px-16 justify-between">
      <h3>Rysk</h3>
      {!provider ? (
        <Button onClick={() => connectWallet?.()}>Connect</Button>
      ) : (
        <p>Connected</p>
      )}
    </div>
  );
};
