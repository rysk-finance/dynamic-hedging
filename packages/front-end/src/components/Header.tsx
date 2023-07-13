import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { Connect } from "src/clients/WalletProvider/components/Connect";
import { AppPaths } from "../config/appPaths";
import { Close } from "src/Icons";
import FadeInDown from "src/animation/FadeInDownDelayed";

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
      <nav className="relative flex items-center px-16 justify-between border-b-2 border-black bg-bone z-50">
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
            {/* <motion.div className="mr-4" layout="position">
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
            </motion.div> */}

            <Connect />
          </LayoutGroup>
        </div>
      </nav>

      <AnimatePresence mode="wait">
        {visible && (
          <motion.b
            className="relative flex justify-center px-16 border-b-2 border-black"
            {...FadeInDown(0.3)}
          >
            <span className="mx-auto py-3 text-sm lg:text-base">
              {`Rysk Finance is using native USDC. To swap your bridged USDC.e, you can `}
              <a
                className="text-cyan-dark-compliant underline"
                href="https://jumper.exchange/?fromChain=42161&fromToken=0xff970a61a04b1ca14834a43f5de4533ebddb5cc8&toChain=42161&toToken=0xaf88d065e77c8cc2239327c5edb3a432268e5831"
                rel="noopener noreferrer"
                target="_blank"
              >
                {`click here.`}
              </a>
            </span>

            <button className="p-3" onClick={handleClose}>
              <Close />
            </button>
          </motion.b>
        )}
      </AnimatePresence>
    </header>
  );
};
