import { LayoutGroup, motion } from "framer-motion";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { Connect } from "src/clients/WalletProvider/components/Connect";
import { AppPaths } from "../config/appPaths";
import { Close } from "src/Icons";

const links = [
  { id: "header-vault", path: AppPaths.VAULT, label: "Vault" },
  { id: "header-options", path: AppPaths.TRADE, label: "Trade Options" },
  { id: "header-dashboard", path: AppPaths.DASHBOARD, label: "Dashboard" },
];

export const Header = () => {
  const { pathname } = useLocation();

  const [visible, setVisible] = useState(true);

  const handleClose = () => setVisible(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-bone">
      <nav className="flex items-center px-16 justify-between border-b-2 border-black">
        <Link to={AppPaths.VAULT}>
          <img
            alt="Rysk logo"
            className="h-20 py-4"
            src={"/logo-animated.gif"}
            title="Rysk: Uncorrelated Returns"
          />
        </Link>

        <div className="flex items-center">
          <LayoutGroup>
            <motion.div className="mr-4" layout="position">
              {links.map(({ id, path, label }) => (
                <Link
                  key={path}
                  id={id}
                  to={path}
                  className={`mr-2 border-none bg-transparent p-2 underline-offset-2 ${
                    pathname === path ? "underline" : ""
                  }`}
                >
                  {label}
                </Link>
              ))}
            </motion.div>

            <Connect />
          </LayoutGroup>
        </div>
      </nav>

      {visible && (
        <b className="relative flex justify-center px-16 border-b-2 border-black font-normal">
          <span className="mx-auto py-3 text-sm lg:text-base">
            {`Rysk Finance is using native USDC. To swap your bridged USDC.e, you can `}
            <a
              className="text-cyan-dark-compliant underline"
              href="https://app.1inch.io/#/42161/simple/swap/USDC.e/USDC"
              rel="noopener noreferrer"
              target="_blank"
            >
              {`click here.`}
            </a>
          </span>

          <button className="p-3" onClick={handleClose}>
            <Close />
          </button>
        </b>
      )}
    </header>
  );
};
