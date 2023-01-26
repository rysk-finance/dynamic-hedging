import type { ReactElement } from "react";

import { createElement, useState } from "react";

interface CardProps {
  tabs: {
    label: string;
    content: ReactElement;
  }[];
  contentNodeType?: string;
  contentClasses?: string;
  wrapperClasses?: string;
  tabWidth?: number;
  tabHeight?: number;
  initialTabIndex?: number;
}

export const Card = ({
  tabs,
  contentNodeType = "div",
  contentClasses = "",
  wrapperClasses = "",
  tabWidth = 180,
  tabHeight = 36,
  initialTabIndex = 0,
}: CardProps) => {
  const [selectedTabIndex, setSelectedTabIndex] = useState(initialTabIndex);

  return (
    <div className={`w-full h-full relative ${wrapperClasses}`}>
      <nav className="flex" role="tablist">
        {tabs.map((tab, index) => (
          <a
            key={tab.label}
            className={`bg-[url('./assets/CardTab.svg')] ${
              tabs.length > 1 && "cursor-pointer"
            } bg-[length:100%_100%] ${
              index !== selectedTabIndex ? "contrast-[50%]" : ""
            } px-2 flex items-center !text-white`}
            style={{
              transform: `translateX(-${index * 10}px)`,
              width: tabWidth,
              height: tabHeight,
              zIndex: index === selectedTabIndex ? 1 : 0,
            }}
            onClick={() => setSelectedTabIndex(index)}
            role="tab"
          >
            {tab.label}
          </a>
        ))}
      </nav>

      {createElement(
        contentNodeType,
        {
          className: `bg-bone border-x-2 border-b-2 rounded-b-xl border-black overflow-hidden border-t-[2px] rounded-tr-lg drop-shadow-lg ${contentClasses}`,
        },
        tabs[selectedTabIndex].content
      )}
    </div>
  );
};
