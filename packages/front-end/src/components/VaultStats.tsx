import React from "react";
import NumberFormat from "react-number-format";
import { Card } from "./shared/Card";
import ReactTooltip from "react-tooltip";
import { RyskTooltip } from "./RyskTooltip";
import { DHV_NAME } from "../config/constants";

export const VaultStats = () => {
  return (
    <div className="pb-8 py-12 px-8 flex flex-col lg:flex-row h-full">
      <div className="flex h-full w-full justify-around">
        <div className="flex flex-col items-left justify-center h-full mb-8 lg:mb-0">
          <p className="mb-2 text-xl">
            Cumulative Yield: {" "}
            <NumberFormat
              value={"2.24"}
              displayType={"text"}
              decimalScale={2}
              suffix="%"
              className="font-medium"
            />
            <RyskTooltip
              id="yieldTip"
              message={`Sum of ${DHV_NAME} returns since inception (Jul 1st 2022)`}
            />
          </p>
          <a
            href="https://docs.rysk.finance"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            Learn more
          </a>
        </div>
        <div className="flex flex-col items-left justify-center h-full mb-8 lg:mb-0">
          <p className="mb-2 text-xl">
            Projected APY: {" "}
            <NumberFormat
              value={"23.45%"}
              displayType={"text"}
              decimalScale={2}
              suffix="%"
              className="font-medium"
            />
            <RyskTooltip
              id="apyTip"
              message="Based on historical returns and the current options exposure"
            />
          </p>
          <a
            href="https://docs.rysk.finance"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            Learn more
          </a>
        </div>
        <div className="flex flex-col items-left justify-center h-full mb-8 lg:mb-0">
          <p className="mb-2 text-xl">
            Current Delta: {" "}
            <NumberFormat
              value={"13.78"}
              displayType={"text"}
              decimalScale={2}
              suffix="%"
              className="font-medium"
            />
            <RyskTooltip
              id="deltaTip"
              message="Current Delta of the DHV option exposure"
            />
          </p>
          <a
            href="https://docs.rysk.finance"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            Learn more
          </a>
        </div>
        <div className="flex flex-col items-left justify-center h-full mb-8 lg:mb-0">
          <p className="mb-2 text-xl">
            Max Drawdown: {" "}
            <NumberFormat
              value={"2.45"}
              displayType={"text"}
              decimalScale={2}
              suffix="%"
              className="font-medium"
            />
            <RyskTooltip
              id="drawdownTip"
              message="Maximum Observed Loss in DHV from peak to a trough"
            />
          </p>
          <a
            href="https://docs.rysk.finance"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            Learn more
          </a>
        </div>
      </div>
    </div>
  );
};
