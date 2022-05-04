import React, { useCallback, useState } from "react";

const LINE_WIDTH = 2;
const MAIN_BORDER_RADIUS = 12;
const MINOR_BORDER_RADIUS = 5;
const TAB_HEIGHT = 20;
const TAB_WIDTH = 100;
const TAB_SLOPE_WIDTH = 30;

export const Card: React.FC = ({ children }) => {
  const [rect, setRect] = useState<DOMRect | null>(null);

  const getSVGRect = useCallback((element: SVGSVGElement) => {
    const boundingRect = element.getBoundingClientRect();
    setRect(boundingRect);
  }, []);

  const svgRef = useCallback((element: SVGSVGElement | null) => {
    if (element) {
      window.addEventListener("resize", () => getSVGRect(element));
      getSVGRect(element);
    }
  }, []);

  return (
    <div className="relative">
      <div className="w-full h-full absolute">
        {
          <svg
            width="100%"
            height="100%"
            strokeWidth={`${LINE_WIDTH}px`}
            ref={svgRef}
          >
            {rect && (
              <path
                d={`m ${MINOR_BORDER_RADIUS} ${LINE_WIDTH / 2}
              L ${TAB_WIDTH} ${LINE_WIDTH / 2}

              C ${TAB_WIDTH + MINOR_BORDER_RADIUS * 2} ${LINE_WIDTH / 2}, ${
                  TAB_WIDTH + TAB_SLOPE_WIDTH - MINOR_BORDER_RADIUS * 2
                } ${TAB_HEIGHT}, ${TAB_WIDTH + TAB_SLOPE_WIDTH} ${TAB_HEIGHT}
              
              L ${
                rect.width - MAIN_BORDER_RADIUS - LINE_WIDTH / 2
              } ${TAB_HEIGHT}
              A ${MAIN_BORDER_RADIUS} ${MAIN_BORDER_RADIUS} 1 0 1 ${
                  rect.width - LINE_WIDTH / 2
                } ${TAB_HEIGHT + MAIN_BORDER_RADIUS}
              L ${rect.width - LINE_WIDTH / 2} ${
                  rect.height - MAIN_BORDER_RADIUS - LINE_WIDTH / 2
                }
              A ${MAIN_BORDER_RADIUS} ${MAIN_BORDER_RADIUS} 1 0 1 ${
                  rect.width - MAIN_BORDER_RADIUS - LINE_WIDTH / 2
                } ${rect.height - LINE_WIDTH / 2}
              L ${MAIN_BORDER_RADIUS} ${rect.height - LINE_WIDTH / 2}
              A ${MAIN_BORDER_RADIUS} ${MAIN_BORDER_RADIUS} 1 0 1 ${
                  LINE_WIDTH / 2
                } ${rect.height - MAIN_BORDER_RADIUS}
              L ${LINE_WIDTH / 2} ${MINOR_BORDER_RADIUS}
              A ${MINOR_BORDER_RADIUS} ${MINOR_BORDER_RADIUS} 1 0 1 ${MINOR_BORDER_RADIUS} ${
                  LINE_WIDTH / 2
                }`}
                fill="transparent"
                stroke="black"
              ></path>
            )}
          </svg>
        }
      </div>
      <div className={`w-full h-full pt-[${TAB_HEIGHT}px]`}>{children}</div>
    </div>
  );
};
