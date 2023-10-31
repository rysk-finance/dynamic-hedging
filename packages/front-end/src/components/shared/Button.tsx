import type { HTMLMotionProps } from "framer-motion";

import { useConnectModal, useChainModal } from "@rainbow-me/rainbowkit";
import { motion } from "framer-motion";
import { useAccount, useNetwork } from "wagmi";

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
  const { openChainModal } = useChainModal();
  const { isDisconnected } = useAccount();
  const { chain } = useNetwork();

  const getDynamicProps = () => {
    switch (true) {
      case isDisconnected:
        return {
          children: "Click to connect",
          onClick: () => {
            if (isDisconnected && openConnectModal) {
              openConnectModal();
            }
          },
          title: "Click to connect a wallet.",
        };

      case chain?.unsupported:
        return {
          children: "Wrong network",
          onClick: () => {
            if (chain?.unsupported && openChainModal) {
              openChainModal();
            }
          },
          title: "Click to switch networks.",
        };
    }
  };

  if (requiresConnection && (isDisconnected || chain?.unsupported)) {
    return (
      <motion.button
        className={`border-black border-2 text-sm px-2 py-1 !bg-black text-white ${props.className}`}
        id={props.id}
        {...getDynamicProps()}
      />
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
