import React from "react";
import { toast } from "react-toastify";
import { EXPLORER_URL } from "../../config/constants";

type TransactionDisplayProps = {
  children: string;
};

export const TransactionDisplay: React.FC<TransactionDisplayProps> = ({
  children,
}) => {
  // const handleCopy = () => {
  //   window.navigator.clipboard.writeText(children);
  //   toast("✅ TX hash copied", { autoClose: 500 });
  // };

  const handleLink = () => {
    window.open(`${EXPLORER_URL}tx/${children}`, "_blank");
  };

  return (
    <>
      {`${children.slice(0, 4)}...${children.slice(
        children.length - 4,
        children.length
      )}`}{" "}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleLink();
        }}
      >
        <img src="/icons/link.svg" className="translate-y-[2px]" />
      </button>
    </>
  );
};
