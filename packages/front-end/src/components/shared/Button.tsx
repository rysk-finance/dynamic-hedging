import type { ButtonHTMLAttributes, DetailedHTMLProps } from "react";

import { useCallback } from "react";

import { useWalletContext } from "../../App";
import { useGlobalContext } from "../../state/GlobalContext";
import { ActionType } from "../../state/types";

interface ButtonProps
  extends DetailedHTMLProps<
    ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > {
  color?: "white" | "black";
  requiresConnection?: boolean;
}

export const Button = ({
  color,
  requiresConnection = false,
  ...props
}: ButtonProps) => {
  const { account, connectWallet } = useWalletContext();
  const { dispatch } = useGlobalContext();

  const handleMouseEnter = useCallback(() => {
    dispatch({
      type: ActionType.SET_CONNECT_WALLET_INDICATOR_IS_ACTIVE,
      isActive: true,
    });
  }, [dispatch]);

  const handleMouseLeave = useCallback(() => {
    dispatch({
      type: ActionType.SET_CONNECT_WALLET_INDICATOR_IS_ACTIVE,
      isActive: false,
    });
  }, [dispatch]);

  if (requiresConnection && !account) {
    return (
      <button
        className={`border-black border-2 text-md px-2 py-1 !bg-black text-white ${props.className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => {
          if (!account) {
            connectWallet?.();
          }
        }}
      >
        Connect
      </button>
    );
  }
  return (
    <button
      {...props}
      className={`border-black border-2  text-md px-2 py-1 transition-all ${
        color === "black" ? "bg-black text-white" : "bg-white text-black"
      } ${props.className ?? ""} ${
        props.disabled ? "!bg-gray-300 !cursor-default !text-gray-600" : ""
      }`}
    />
  );
};
