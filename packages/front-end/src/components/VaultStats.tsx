import React from "react";
import NumberFormat from "react-number-format";
import { Card } from "./shared/Card";
import ReactTooltip from "react-tooltip";
import { RyskTooltip } from "./RyskTooltip";

export const VaultStats = () => {
  return (
    <Card tabPunchColor="bone" headerContent="DHV.stats">
      <div className="pb-8 py-12 px-8 flex flex-col lg:flex-row h-full">
        <div className="flex h-full w-full justify-around">
          <div className="flex flex-col items-center justify-center h-full mb-8 lg:mb-0">
            <h3 className="mb-2">
              <NumberFormat
                value={"13.47"}
                displayType={"text"}
                decimalScale={2}
                suffix="%"
              />
            </h3>
            <h4 className="mb-2">
              Cumulative Yield
              <RyskTooltip
                id="yieldTip"
                message="Sum of DHV returns since inception (Jul 1st 2022)"
              />
            </h4>
            <a
              href="https://docs.rysk.finance"
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              Learn more
            </a>
          </div>
          <div className="flex flex-col items-center justify-center h-full mb-8 lg:mb-0">
            <h3 className="mb-2">
              <NumberFormat
                value={"23.45%"}
                displayType={"text"}
                decimalScale={2}
                suffix="%"
              />
            </h3>
            <h4 className="mb-2">
              Projected APY
              <RyskTooltip
                id="apyTip"
                message="Based on DHV historical returns and the current DHV options exposure"
              />
            </h4>
            <a
              href="https://docs.rysk.finance"
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              Learn more
            </a>
          </div>
          <div className="flex flex-col items-center justify-center h-full mb-8 lg:mb-0">
            <h3 className="mb-2">
              <NumberFormat
                value={"13.78"}
                displayType={"text"}
                decimalScale={2}
                suffix="%"
              />
            </h3>
            <h4 className="mb-2">
              Current Delta
              <RyskTooltip
                id="deltaTip"
                message="Current Delta of the DHV option exposure"
              />
            </h4>
            <a
              href="https://docs.rysk.finance"
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              Learn more
            </a>
          </div>
          <div className="flex flex-col items-center justify-center h-full mb-8 lg:mb-0">
            <h3 className="mb-2">
              <NumberFormat
                value={"2.45"}
                displayType={"text"}
                decimalScale={2}
                suffix="%"
              />
            </h3>
            <h4 className="mb-2">
              Max Drawdown
              <RyskTooltip
                id="drawdownTip"
                message="Maximum Observed Loss in DHV from peak to a trough"
              />
            </h4>
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
    </Card>
  );
};
