import React, { useState } from "react";
import { Card } from "../shared/Card";

export const WIPPopup = () => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      {isOpen && (
        <>
          <div className="fixed bg-black opacity-[0.5] w-full h-full top-24 left-0 z-10" />
          <div
            className="fixed w-full h-full flex justify-center items-center top-24 left-0 z-[100] p-64"
            // onClick={() => setIsOpen(false)}
          >
            <Card
              tabs={[
                {
                  label: "Coming soon",
                  content: (
                    <div className="p-8 bg-bone">
                      {/* TODO(HC): Update copy */}
                      <p className="mb-4">
                        Our options trading platform isn&apos;t ready yet.
                      </p>
                    </div>
                  ),
                },
              ]}
            ></Card>
          </div>
        </>
      )}
    </>
  );
};
