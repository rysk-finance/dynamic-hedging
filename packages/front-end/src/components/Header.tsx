import React from "react";
import { Link } from "react-router-dom";
import { useWalletContext } from "../App";
import { Button } from "./Button";

export const Header: React.FC = () => {
  const { connectWallet, provider } = useWalletContext();

  return (
    <div className="fixed w-full h-24 t-0 flex items-center px-16 justify-between border-b-2 border-black">
      <img src={"/logo.png"} alt="logo" className="h-[50%]" />
      <div className="flex">
        <div className="mr-4">
          <Link to="/">
            <Button className="mr-2 border-none bg-transparent">Vault</Button>
          </Link>
          <Link to="/options">
            <Button className="mr-2 border-none bg-transparent">
              Trade Options
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button className="mr-2 border-none bg-transparent">
              Dashboard
            </Button>
          </Link>
        </div>
        {!provider ? (
          <Button onClick={() => connectWallet?.()}>Connect</Button>
        ) : (
          <p>Connected</p>
        )}
      </div>
    </div>
  );
};
