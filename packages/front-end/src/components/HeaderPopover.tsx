import React, { useState } from "react";
import { toast } from "react-toastify";
import { useWalletContext } from "../App";
import { Button } from "./shared/Button";

export const HeaderPopover: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const { account, disconnect } = useWalletContext();

  return (
    <div className="flex items-center">
      <Button type="button" onClick={() => setIsOpen((old) => !old)}>
        {`${account?.slice(0, 4)}...${account?.slice(
          account.length - 4,
          account.length
        )}`}{" "}
        {isOpen ? "▼" : "▲"}
      </Button>

      {isOpen && (
        <div className="fixed top-[72px] bg-bone border-2 border-black right-16 p-2">
          <div className="flex flex-col">
            <Button
              onClick={() => {
                account && navigator.clipboard.writeText(account);
                toast("Address coppied to clipboard", { autoClose: 1000 });
              }}
              className="mb-[-2px] bg-bone"
            >
              Copy address
            </Button>
            <Button
              onClick={() => {
                account &&
                  window.open(`https://etherscan.io/address/${account}`);
              }}
              className="mb-4"
            >
              Open in Etherscan
            </Button>
            <Button
              onClick={() => {
                disconnect?.();
              }}
            >
              Disconnect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
