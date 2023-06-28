import type { CardProps } from "../../types";

import { useAccount } from "wagmi";

export const Card = ({
  children,
  disabled,
  explainer,
  hasData,
  span = "col-span-1",
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
      className={`flex flex-col ${span} ${disabled ? "opacity-40" : ""}`}
      key={title}
    >
      <span className="w-fit flex items-center bg-[url('./assets/CardTab.svg')] bg-[length:100%_100%]">
        <span
          className={`${tabColor} w-3 h-3 rounded-full mx-3 ease-in-out duration-100`}
        />
        <h3 className="text-white py-2 font-dm-mono mr-9">{title}</h3>
      </span>
      <span className="block h-full border-black border-2 rounded-r-lg rounded-bl-lg drop-shadow-lg p-2 bg-[url('./assets/white-ascii-50.png')] bg-fixed">
        {children}

        <em className="block not-italic text-xs border-black border-t pt-3">
          {disabled ? "Coming soon..." : explainer}
        </em>
      </span>
    </div>
  );
};
