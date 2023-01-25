import type { ButtonHTMLAttributes, DetailedHTMLProps } from "react";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useCallback } from "react";
import { useAccount } from "wagmi";

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
  const { openConnectModal } = useConnectModal();
  const { isDisconnected } = useAccount();

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

  if (requiresConnection && isDisconnected) {
    return (
      <button
        className={`border-black border-2 text-md px-2 py-1 !bg-black text-white ${props.className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => {
          if (isDisconnected && openConnectModal) {
            openConnectModal();
          }
        }}
      >
        {`Click to connect`}
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
