import { useConnectWallet } from "@web3-onboard/react";
import React from "react";
import { Button } from "./Button";

export const Header: React.FC = () => {
  const [{ wallet }, connect] = useConnectWallet();

  return (
    <div className="fixed w-full h-16 t-0 flex items-center px-8 justify-between">
      <h1>Rysk</h1>
      {!wallet && <Button onClick={() => connect({})}>Connect</Button>}
    </div>
  );
};
