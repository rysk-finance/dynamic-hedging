import type { CardProps } from "./types";

import { AnimatePresence, motion } from "framer-motion";
import { useAccount } from "wagmi";

import { Loading } from "src/Icons";
import FadeInOut from "src/animation/FadeInOut";

export const Card = ({
  children,
  disabled,
  explainer,
  hasData,
  loading,
  span = ["col-span-2", "xl:col-span-1"],
  title,
}: CardProps) => {
  const { isConnected } = useAccount();

  const tabColor =
    hasData && !disabled && isConnected
      ? "bg-green-500"
      : !disabled && isConnected
      ? "bg-yellow-600"
      : "bg-red-500";

  return (
    <div
      className={`relative flex flex-col ${span[0]} ${span[1]} ${
        disabled ? "opacity-40" : ""
      }`}
      key={title}
    >
      <span className="w-fit flex items-center bg-[url('./assets/CardTab.svg')] bg-[length:100%_100%] max-w-[90%]">
        <span
          className={`${tabColor} min-w-[0.75rem] h-3 rounded-full mx-3 ease-in-out duration-100`}
        />
        <h3 className="truncate text-white py-2 font-dm-mono mr-9">{title}</h3>
      </span>
      <span className="flex flex-col h-full border-black border-2 rounded-r-lg rounded-bl-lg drop-shadow-lg p-2 bg-[url('./assets/white-ascii-50.png')] bg-fixed">
        <AnimatePresence initial={false}>
          {!disabled && loading && (
            <motion.span
              className="absolute inset-0 z-10 flex items-center w-full h-full bg-black/10"
              key="data-loading"
              {...FadeInOut()}
            >
              <Loading className="h-12 mx-auto animate-spin text-bone-light" />
            </motion.span>
          )}
        </AnimatePresence>

        {children}

        <em className="block not-italic text-xs border-black border-t mt-auto pt-2">
          {disabled ? "Coming soon..." : explainer}
        </em>
      </span>
    </div>
  );
};
