import { useConnectWallet } from "@web3-onboard/react";
import React from "react";
import { Button } from "./Button";

export const Header: React.FC = () => {
  const [{ wallet }, connect] = useConnectWallet();

  return (
    <div className="fixed w-full h-16 t-0 flex items-center px-16 justify-between">
      <h3>Rysk</h3>
      {!wallet && <Button onClick={() => connect({})}>Connect</Button>}
    </div>
  );
};
