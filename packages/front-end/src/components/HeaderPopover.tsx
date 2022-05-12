import React, { useState } from "react";

export const HeaderPopover: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={() => setIsOpen((old) => !old)}
        className="rounded-full flex items-center justify-center w-10 h-10 border-2 border-black bg-white"
      ></button>

      {isOpen && (
        <div className="fixed top-[72px] bg-bone border-2 border-black right-16 p-8">
          Popper element
        </div>
      )}
    </div>
  );
};
