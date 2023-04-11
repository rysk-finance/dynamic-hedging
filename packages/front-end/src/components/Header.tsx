import { Link, useLocation } from "react-router-dom";
import { motion, LayoutGroup } from "framer-motion";

import { AppPaths } from "../config/appPaths";
import { Connect } from "src/clients/WalletProvider/components/Connect";

const links = [
  { id: "header-vault", path: AppPaths.VAULT, label: "Vault" },
  { id: "header-options", path: AppPaths.TRADE, label: "Trade Options" },
  { id: "header-dashboard", path: AppPaths.DASHBOARD, label: "Dashboard" },
];

export const Header = () => {
  const { pathname } = useLocation();

  return (
    <div className="fixed w-full h-24 t-0 flex items-center px-16 justify-between border-b-2 border-black bg-bone z-20">
      <Link to={AppPaths.VAULT}>
        <img src={"/logo.png"} alt="logo" className="w-20" />
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
    </div>
  );
};
