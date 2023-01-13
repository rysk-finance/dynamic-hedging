import type { ReactElement } from "react";

import { useState } from "react";

interface CardProps {
  tabs: {
    label: string;
    content: ReactElement;
    title?: ReactElement;
  }[];
  tabWidth?: number;
  tabHeight?: number;
  initialTabIndex?: number;
}

export const Card = ({
  tabs,
  tabWidth = 180,
  tabHeight = 36,
  initialTabIndex = 0,
}: CardProps) => {
  const [selectedTabIndex, setSelectedTabIndex] = useState(initialTabIndex);

  return (
    <div className="w-full h-full relative">
      <div className="flex">
        {tabs.map((tab, index) => (
          <div
            key={tab.label}
            className={`bg-[url('./assets/CardTab.svg')] ${
              tabs.length > 1 && "cursor-pointer"
            } bg-[length:100%_100%] ${
              index !== selectedTabIndex ? "contrast-[50%]" : ""
            } px-2 flex items-center`}
            style={{
              transform: `translateX(-${index * 10}px)`,
              width: tabWidth,
              height: tabHeight,
              zIndex: index === selectedTabIndex ? 1 : 0,
            }}
            onClick={() => setSelectedTabIndex(index)}
          >
            <p className="text-white">{tab.label}</p>
          </div>
        ))}
      </div>
      {tabs[selectedTabIndex].title && (
        <div className="bg-black rounded-tr-lg h-[60px]">
          <p>{tabs[selectedTabIndex].title}</p>
        </div>
      )}
      <div
        className={`border-x-2 border-b-2 rounded-b-xl border-black overflow-hidden ${
          !tabs[selectedTabIndex].title && "border-t-[2px] rounded-tr-lg"
        }`}
      >
        {tabs[selectedTabIndex].content}
      </div>
    </div>
  );
};
