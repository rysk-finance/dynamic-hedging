import React from "react";
import { Link } from "react-router-dom";
import { useWalletContext } from "../App";
import { AppPaths } from "../config/appPaths";
import { Button } from "./shared/Button";

export const Header: React.FC = () => {
  const { connectWallet, provider } = useWalletContext();

  return (
    <div className="fixed w-full h-24 t-0 flex items-center px-16 justify-between border-b-2 border-black bg-bone">
      <img src={"/logo.png"} alt="logo" className="h-[50%]" />
      <div className="flex">
        <div className="mr-4">
          <Link to={AppPaths.VAULT}>
            <button className="mr-2 border-none bg-transparent p-2">
              Vault
            </button>
          </Link>
          <Link to={AppPaths.TRADE}>
            <button className="mr-2 border-none bg-transparent p-2">
              Trade Options
            </button>
          </Link>
          <Link to={AppPaths.DASHBOARD}>
            <button className="mr-2 border-none bg-transparent p-2">
              Dashboard
            </button>
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
