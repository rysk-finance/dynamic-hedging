import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useAccount, useDisconnect } from "wagmi";

import { EXPLORER_URL } from "../config/constants";
import { useGlobalContext } from "../state/GlobalContext";
import { ActionType } from "../state/types";
import { Button } from "./shared/Button";

export const HeaderPopover = () => {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();

  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { dispatch } = useGlobalContext();

  const handleClickOutside = (event: MouseEvent) => {
    if (
      isOpenRef.current &&
      containerRef.current &&
      !containerRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    window.addEventListener("click", handleClickOutside);

    return () => {
      window.removeEventListener("click", handleClickOutside);
    };
  }, []);

  return (
    <div className="flex items-center" ref={containerRef}>
      <Button
        type="button"
        onClick={() => setIsOpen((old) => !old)}
        color="black"
        className="flex items-center"
      >
        <img
          src="/arbitrum_logo.svg"
          className="h-4 w-auto mr-2"
          alt="Arbitrum"
        />
        {`${address?.slice(0, 4)}...${address?.slice(
          address.length - 4,
          address.length
        )}`}{" "}
        {isOpen ? "▼" : "▲"}
      </Button>

      {isOpen && (
        <div className="fixed top-[72px] bg-bone border-2 border-black right-16 p-2 min-w-[300px]">
          <div className="flex flex-col">
            <Button
              onClick={() => {
                address && navigator.clipboard.writeText(address);
                toast("✅ Address copied to clipboard", { autoClose: 1000 });
              }}
              className="mb-[-2px] bg-bone mb-[2px]"
            >
              Copy address
            </Button>

            <Button
              onClick={() => {
                address && window.open(`${EXPLORER_URL}address/${address}`);
              }}
              className="mb-4"
            >
              Open in Explorer
            </Button>

            <Button
              onClick={() => {
                disconnect();
                dispatch({ type: ActionType.RESET_GLOBAL_STATE });
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
