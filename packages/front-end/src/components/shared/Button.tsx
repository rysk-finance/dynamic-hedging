import type { ButtonHTMLAttributes, DetailedHTMLProps } from "react";

import { useCallback } from "react";
import { useAccount, useConnect } from "wagmi";

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
  const { isDisconnected } = useAccount();
  const { connect, connectors } = useConnect();

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

  // Temp code until we use rainbow-kit
  const connector = connectors[0];

  if (requiresConnection && isDisconnected) {
    return (
      <button
        className={`border-black border-2 text-md px-2 py-1 !bg-black text-white ${props.className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => {
          if (isDisconnected) {
            connect({ connector });
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
