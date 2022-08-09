import React from "react";
import ReactTooltip, { TooltipProps } from "react-tooltip";

type RyskTooltipProps = {
  message: string;
  id: string;
  color?: "green" | "yellow" | "red";
  tooltipProps?: TooltipProps;
  icon?: React.ReactElement;
};

export const RyskTooltip: React.FC<RyskTooltipProps> = ({
  message,
  id,
  color,
  tooltipProps = {},
  icon,
}) => {
  return (
    <>
      <ReactTooltip
        id={id}
        place="bottom"
        multiline={true}
        backgroundColor="#EDE9DD"
        textColor="black"
        border={true}
        borderColor="black"
        {...tooltipProps}
      >
        {message}
      </ReactTooltip>
      <button data-tip data-for={id} className={`cursor-help pl-2 rounded-lg`}>
        {icon ? (
          icon
        ) : (
          <img
            src="/icons/info.svg"
            className={`${color ? `bg-${color}-500` : ""} rounded-lg`}
          />
        )}
      </button>
    </>
  );
};
