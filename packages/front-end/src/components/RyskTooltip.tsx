import React from "react";
import ReactTooltip, { TooltipProps } from "react-tooltip";

type RyskTooltipProps = {
  message: React.ReactChild;
  id: string;
  color?: "green" | "yellow" | "red" | "white";
  tooltipProps?: TooltipProps;
  icon?: React.ReactElement;
  html?: boolean;
  iconProps?: React.HTMLProps<HTMLDivElement>;
};

export const RyskTooltip: React.FC<RyskTooltipProps> = ({
  message,
  id,
  color,
  tooltipProps = {},
  icon,
  html,
  iconProps: { className: iconClassName, ...restIconProps } = {},
}) => {
  return (
    <>
      <ReactTooltip
        id={id}
        place="bottom"
        multiline={true}
        html={html}
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
          <div
            className={`${
              color ? (color === "white" ? "bg-white" : `bg-${color}-500`) : ""
            } rounded-lg ${iconClassName}`}
            {...restIconProps}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 15 15"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M7.43709 0C3.3297 0 0 3.3297 0 7.43709C0 11.5444 3.3297 14.8742 7.43709 14.8742C11.5444 14.8742 14.8742 11.5444 14.8742 7.43709C14.8742 3.3297 11.5444 0 7.43709 0ZM0.95 7.43709C0.95 3.85437 3.85437 0.95 7.43709 0.95C11.0198 0.95 13.9242 3.85437 13.9242 7.43709C13.9242 11.0198 11.0198 13.9242 7.43709 13.9242C3.85437 13.9242 0.95 11.0198 0.95 7.43709ZM9.13652 4.36736C9.13652 4.9928 8.62951 5.49981 8.00408 5.49981C7.37864 5.49981 6.87163 4.9928 6.87163 4.36736C6.87163 3.74193 7.37864 3.23492 8.00408 3.23492C8.62951 3.23492 9.13652 3.74193 9.13652 4.36736ZM5.80508 5.80471H6.30508H7.43752C7.71367 5.80471 7.93752 6.02857 7.93752 6.30471V10.3345H8.56997H9.06997V11.3345H8.56997H7.43752H6.30508H5.80508V10.3345H6.30508H6.93752V6.80471H6.30508H5.80508V5.80471Z"
                fill="black"
              />
            </svg>
          </div>
        )}
      </button>
    </>
  );
};
