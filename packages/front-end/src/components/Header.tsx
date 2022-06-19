import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useWalletContext } from "../App";
import { AppPaths } from "../config/appPaths";
import { CHAINID, IDToNetwork } from "../config/constants";
import { useGlobalContext } from "../state/GlobalContext";
import { HeaderPopover } from "./HeaderPopover";
import { Button } from "./shared/Button";

export const Header: React.FC = () => {
  const {
    state: { connectWalletIndicatorActive },
  } = useGlobalContext();
  const { connectWallet, provider, disconnect, network } = useWalletContext();
  const { pathname } = useLocation();

  const envChainID = process.env.REACT_APP_CHAIN_ID;
  const connectedChainId = network?.id;

  const incorrectNetwork =
    connectedChainId && envChainID && connectedChainId !== Number(envChainID);

  return (
    <div className="fixed w-full h-24 t-0 flex items-center px-16 justify-between border-b-2 border-black bg-bone z-10">
      <img src={"/logo.png"} alt="logo" className="h-[50%]" />
      <div className="flex items-center">
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
          <>
            <HeaderPopover />
            {incorrectNetwork && (
              <div className="h-full flex items-center relative group">
                <img
                  src="/icons/stop.svg"
                  className="h-[30px] ml-2 stroke-red"
                />
                <div className="fill-bone border-2 border-black p-2 absolute top-[30px] right-0 bg-bone hidden group-hover:block w-[200px]">
                  {/* TODO: Figure out copy */}
                  <p>
                    Rysk runs on Arbitrum. Please connect to this network to
                    continue.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
