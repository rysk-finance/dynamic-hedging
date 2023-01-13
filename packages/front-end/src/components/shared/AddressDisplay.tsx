import { toast } from "react-toastify";

type AddressDisplayProps = {
  children: string;
};

export const AddressDisplay = ({ children }: AddressDisplayProps) => {
  const handleCopy = () => {
    window.navigator.clipboard.writeText(children);
    toast("✅ Copied", { autoClose: 500 });
  };

  return (
    <>
      {children}{" "}
      <button onClick={handleCopy}>
        <img src="/icons/copy.svg" />
      </button>
    </>
  );
};
