import { Link, useLocation } from "react-router-dom";
import { motion, LayoutGroup } from "framer-motion";
import { useAccount } from "wagmi";

import { AppPaths } from "../config/appPaths";
import { Connect } from "src/clients/WalletProvider/components/Connect";
import { Podium } from "src/Icons";

const links = [
  // { id: "header-vault", path: AppPaths.VAULT, label: "Vault" },
  { id: "header-options", path: AppPaths.TRADE, label: "Trade Options" },
  { id: "header-dashboard", path: AppPaths.DASHBOARD, label: "Dashboard" },
];

export const Header = () => {
  const { address } = useAccount();
  const { pathname } = useLocation();

  return (
    <div className="fixed w-full h-24 t-0 flex items-center px-16 justify-between border-b-2 border-black bg-bone z-20">
      <Link to={AppPaths.TRADE}>
        <img
          alt="Rysk logo"
          className="w-20"
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

          <motion.a
            className="flex items-center mr-8"
            href={`https://www.rysk.finance/leaderboard/${
              address ? `?address=${address.toLowerCase()}` : ""
            }`}
            layout="position"
            rel="noreferrer noopener"
            target="_blank"
            title="Click to view the competition leaderboard."
          >
            <Podium className="fill-black w-10 h-10" key="leader-board" />
          </motion.a>

          <Connect />
        </LayoutGroup>
      </div>
    </div>
  );
};
