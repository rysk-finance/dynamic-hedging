import { EXPLORER_URL } from "../../config/constants";

type TransactionDisplayProps = {
  children: string;
};

export const TransactionDisplay = ({ children }: TransactionDisplayProps) => {
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
