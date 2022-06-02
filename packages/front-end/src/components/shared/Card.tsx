import React, { useCallback, useState, FC } from "react";

const DEFAULT_LINE_WIDTH = 2;
const DEFAULT_MAIN_BORDER_RADIUS = 12;
const DEFAULT_MINOR_BORDER_RADIUS = 5;
const DEFAULT_TAB_HEIGHT = 20;
const DEFAULT_TAB_WIDTH = 100;
const DEFAULT_TAB_SLOPE_WIDTH = 30;
const DEFAULT_HEADER_HEIGHT = 20;

type CardProps = {
  lineWidth?: number;
  mainBorderRadius?: number;
  minorBorderRadius?: number;
  tabHeight?: number;
  tabWidth?: number;
  tabSlopeWidth?: number;
  filledHeader?: boolean;
  headerHeight?: number;
  tabPunchColor?: string;
};

export const Card: React.FC<CardProps> = ({
  children,
  lineWidth = DEFAULT_LINE_WIDTH,
  mainBorderRadius = DEFAULT_MAIN_BORDER_RADIUS,
  minorBorderRadius = DEFAULT_MINOR_BORDER_RADIUS,
  tabHeight = DEFAULT_TAB_HEIGHT,
  tabWidth = DEFAULT_TAB_WIDTH,
  tabSlopeWidth = DEFAULT_TAB_SLOPE_WIDTH,
  filledHeader = false,
  headerHeight = DEFAULT_HEADER_HEIGHT,
  tabPunchColor,
}) => {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [svgElement, setSVGElement] = useState<SVGSVGElement | null>(null);

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
      if (!svgElement) {
        setSVGElement(element);
      }
    },
    [getSVGRect]
  );

  const containerRef = useCallback(
    (element: HTMLDivElement | null) => {
      if (element && svgElement) {
        new ResizeObserver(() => getSVGRect(svgElement)).observe(element);
      }
    },
    [svgElement]
  );

  return (
    <div className="w-full h-full relative" ref={containerRef}>
      <div className="w-full h-full absolute pointer-events-none">
        {
          <svg
            width="100%"
            height="100%"
            strokeWidth={`${lineWidth}px`}
            ref={svgRef}
          >
            {tabPunchColor && (
              <>
                <circle
                  cx={`${tabHeight / 2}px`}
                  cy={`${tabHeight / 2}px`}
                  r={`${(tabHeight - 12) / 2.0}px`}
                  fill="transparent"
                  className={`stroke-${tabPunchColor}`}
                ></circle>
                <circle
                  cx={`${tabHeight / 2}px`}
                  cy={`${tabHeight / 2}px`}
                  r={`${(tabHeight - 12) / 3.5}px`}
                  fill="transparent"
                  className={`stroke-${tabPunchColor}`}
                ></circle>
              </>
            )}
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
            {rect && filledHeader && (
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
              L ${rect.width - lineWidth / 2} ${tabHeight + headerHeight}
              L 0 ${tabHeight + headerHeight}
              L ${lineWidth / 2} ${minorBorderRadius}
              A ${minorBorderRadius} ${minorBorderRadius} 1 0 1 ${minorBorderRadius} ${
                  lineWidth / 2
                }`}
                stroke="black"
                fill="black"
              ></path>
            )}
          </svg>
        }
      </div>
      <div
        className="w-full relative h-full"
        style={{
          paddingTop: tabHeight,
        }}
      >
        {children}
      </div>
    </div>
  );
};
