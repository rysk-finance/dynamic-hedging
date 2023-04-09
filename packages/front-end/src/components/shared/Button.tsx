import type { HTMLMotionProps } from "framer-motion";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { motion } from "framer-motion";
import { useCallback } from "react";
import { useAccount } from "wagmi";

import { useGlobalContext } from "../../state/GlobalContext";
import { ActionType } from "../../state/types";

export interface ButtonProps extends HTMLMotionProps<"button"> {
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
      <motion.button
        className={`border-black border-2 text-md px-2 py-1 !bg-black text-white ${props.className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => {
          if (isDisconnected && openConnectModal) {
            openConnectModal();
          }
        }}
        title="Click to connect a wallet."
      >
        {`Click to connect`}
      </motion.button>
    );
  }
  return (
    <motion.button
      {...props}
      className={`border-black border-2 text-md px-2 py-1 transition-all ${
        color === "black" ? "bg-black text-white" : "bg-white text-black"
      } ${props.className ?? ""} ${
        props.disabled ? "!bg-gray-300 !cursor-default !text-gray-600" : ""
      }`}
    />
  );
};
