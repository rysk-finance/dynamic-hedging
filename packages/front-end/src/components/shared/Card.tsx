import React, { useState } from "react";

type CardTab = { label: string; content: React.ReactElement; title?: string };

type CardProps = {
  tabs: CardTab[];
  tabWidth?: number;
  tabHeight?: number;
};

export const Card: React.FC<CardProps> = ({
  tabs,
  tabWidth = 180,
  tabHeight = 30,
}) => {
  const [selectedTabIndex, setSelectedTabIndex] = useState(0);

  return (
    <div className="w-full h-full relative">
      <div className="flex">
        {tabs.map((tab, index) => (
          <div
            key={tab.label}
            className={`bg-[url('./assets/CardTab.svg')] ${
              tabs.length > 1 && "cursor-pointer"
            } bg-[length:100%_100%] ${
              index !== selectedTabIndex ? "contrast-[75%]" : ""
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
      {tabs[selectedTabIndex].title ? (
        <div className="bg-black rounded-tr-lg h-[60px]">
          <p>{tabs[selectedTabIndex].title}</p>
        </div>
      ) : (
        <div className="border-t-[2px] border-x-[2px] border-black rounded-tr-lg h-[5px]" />
      )}
      <div className="border-x-2 border-b-2 rounded-b-xl border-black overflow-hidden">
        {tabs[selectedTabIndex].content}
      </div>
    </div>
  );
};
