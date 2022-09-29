import React, { useState } from "react";
import { DISCORD_LINK } from "../../config/links";
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
                  label: "Soon ™",
                  content: (
                    <div className="p-8 bg-bone">
                      {/* TODO(HC): Update copy */}
                      <p className="text-lg mb-4">
                        Options trading platform will be available on Rysk Beyond!
                      </p>
                      <p className="mb-4">
                        If you are interested in trading options { " " }
                        <a href={DISCORD_LINK} target="blank" className="underline">
                          get in contact with us
                        </a>.
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
