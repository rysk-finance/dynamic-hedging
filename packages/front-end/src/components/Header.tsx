import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useWalletContext } from "../App";
import { AppPaths } from "../config/appPaths";
import { useGlobalContext } from "../state/GlobalContext";
import { Button } from "./shared/Button";

export const Header: React.FC = () => {
  const {
    state: { connectWalletIndicatorActive },
  } = useGlobalContext();
  const { connectWallet, provider } = useWalletContext();
  const { pathname } = useLocation();

  return (
    <div className="fixed w-full h-24 t-0 flex items-center px-16 justify-between border-b-2 border-black bg-bone z-10">
      <img src={"/logo.png"} alt="logo" className="h-[50%]" />
      <div className="flex">
        <div className="mr-4">
          <Link to={AppPaths.VAULT}>
            <button
              className={`mr-2 border-none bg-transparent p-2 underline-offset-2	${
                pathname === AppPaths.VAULT ? "underline" : ""
              }`}
            >
              Vault
            </button>
          </Link>
          <Link to={AppPaths.TRADE}>
            <button
              className={`mr-2 border-none bg-transparent p-2 underline-offset-2 ${
                pathname === AppPaths.TRADE ? "underline" : ""
              }`}
            >
              Trade Options
            </button>
          </Link>
          <Link to={AppPaths.DASHBOARD}>
            <button
              className={`mr-2 border-none bg-transparent p-2 underline-offset-2 ${
                pathname === AppPaths.DASHBOARD ? "underline" : ""
              }`}
            >
              Dashboard
            </button>
          </Link>
        </div>
        {!provider ? (
          <Button
            onClick={() => connectWallet?.()}
            className={`origin-center transition-transform ${
              connectWalletIndicatorActive ? "scale-110" : ""
            }`}
          >
            Connect
          </Button>
        ) : (
          <p>Connected</p>
        )}
      </div>
    </div>
  );
};
