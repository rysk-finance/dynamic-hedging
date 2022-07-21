import React from "react";
import { toast } from "react-toastify";

type TransactionDisplayProps = {
  children: string;
};

export const TransactionDisplay: React.FC<TransactionDisplayProps> = ({
  children,
}) => {
  const handleCopy = () => {
    window.navigator.clipboard.writeText(children);
    toast("✅ TX hash copied", { autoClose: 500 });
  };

  return (
    <>
      {`${children.slice(0, 4)}...${children.slice(
        children.length - 4,
        children.length
      )}`}{" "}
      <button onClick={handleCopy}>
        <img src="/icons/copy.svg" />
      </button>
    </>
  );
};
