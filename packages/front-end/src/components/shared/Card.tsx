import React, { useCallback, useState } from "react";

const DEFAULT_LINE_WIDTH = 2;
const DEFAULT_MAIN_BORDER_RADIUS = 12;
const DEFAULT_MINOR_BORDER_RADIUS = 5;
const DEFAULT_TAB_HEIGHT = 20;
const DEFAULT_TAB_WIDTH = 100;
const DEFAULT_TAB_SLOPE_WIDTH = 30;

type CardProps = {
  lineWidth?: number;
  mainBorderRadius?: number;
  minorBorderRadius?: number;
  tabHeight?: number;
  tabWidth?: number;
  tabSlopeWidth?: number;
};

export const Card: React.FC<CardProps> = ({
  children,
  lineWidth = DEFAULT_LINE_WIDTH,
  mainBorderRadius = DEFAULT_MAIN_BORDER_RADIUS,
  minorBorderRadius = DEFAULT_MINOR_BORDER_RADIUS,
  tabHeight = DEFAULT_TAB_HEIGHT,
  tabWidth = DEFAULT_TAB_WIDTH,
  tabSlopeWidth = DEFAULT_TAB_SLOPE_WIDTH,
}) => {
  const [rect, setRect] = useState<DOMRect | null>(null);

  const getSVGRect = useCallback((element: SVGSVGElement) => {
    const boundingRect = element.getBoundingClientRect();
    setRect(boundingRect);
  }, []);

  const svgRef = useCallback(
    (element: SVGSVGElement | null) => {
      if (element) {
        window.addEventListener("resize", () => getSVGRect(element));
        getSVGRect(element);
      }
    },
    [getSVGRect]
  );

  return (
    <div className="w-full h-full relative">
      <div className="w-full h-full absolute pointer-events-none">
        {
          <svg
            width="100%"
            height="100%"
            strokeWidth={`${lineWidth}px`}
            ref={svgRef}
          >
            {rect && (
              <path
                d={`m ${minorBorderRadius} ${lineWidth / 2}
              L ${tabWidth} ${lineWidth / 2}

              C ${tabWidth + minorBorderRadius * 2} ${lineWidth / 2}, ${
                  tabWidth + tabSlopeWidth - minorBorderRadius * 2
                } ${tabHeight}, ${tabWidth + tabSlopeWidth} ${tabHeight}
              
              L ${rect.width - mainBorderRadius - lineWidth / 2} ${tabHeight}
              A ${mainBorderRadius} ${mainBorderRadius} 1 0 1 ${
                  rect.width - lineWidth / 2
                } ${tabHeight + mainBorderRadius}
              L ${rect.width - lineWidth / 2} ${
                  rect.height - mainBorderRadius - lineWidth / 2
                }
              A ${mainBorderRadius} ${mainBorderRadius} 1 0 1 ${
                  rect.width - mainBorderRadius - lineWidth / 2
                } ${rect.height - lineWidth / 2}
              L ${mainBorderRadius} ${rect.height - lineWidth / 2}
              A ${mainBorderRadius} ${mainBorderRadius} 1 0 1 ${
                  lineWidth / 2
                } ${rect.height - mainBorderRadius}
              L ${lineWidth / 2} ${minorBorderRadius}
              A ${minorBorderRadius} ${minorBorderRadius} 1 0 1 ${minorBorderRadius} ${
                  lineWidth / 2
                }`}
                fill="transparent"
                stroke="black"
              ></path>
            )}
          </svg>
        }
      </div>
      <div
        className="w-full"
        style={{
          paddingTop: tabHeight,
          height: `calc(100% - ${tabHeight}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
};
