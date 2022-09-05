import React from "react";
import NumberFormat from "react-number-format";
import { Card } from "./shared/Card";
import ReactTooltip from "react-tooltip";
import { RyskTooltip } from "./RyskTooltip";
import { DHV_NAME } from "../config/constants";

export const VaultRisksStats = () => {
  return (
    <div className="pb-8 py-12 px-8 flex flex-col lg:flex-row h-full">
      <div className="flex h-full w-full justify-around">
        <div className="flex flex-col items-left justify-center h-full mb-8 lg:mb-0">
          <p className="mb-2 text-xl">
            Current Delta:{" "}
            <NumberFormat
              value={"13.78"}
              displayType={"text"}
              decimalScale={2}
              suffix="%"
              className="font-medium"
            />
            <RyskTooltip
              id="deltaTip"
              message="
                Delta, Δ, measures the rate of change in the value of the portfolio with respect to a change in the price of ETH. <br />
                A Delta close to zero means that the exposure is neutral to market movements.
              "
            />
          </p>
          {/* <a
            href="https://docs.rysk.finance"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            Learn more
          </a> */}
        </div>
        <div className="flex flex-col items-left justify-center h-full mb-8 lg:mb-0">
          <p className="mb-2 text-xl">
            Sharpe Ratio: {" "}
            TBC
            {/* <RyskTooltip
              id="sharpeTip"
              message=""
            /> */}
          </p>
          {/* <a
            href="https://docs.rysk.finance"
            className="underline text-center"
            target="_blank"
            rel="noreferrer"
          >
            Learn more
          </a> */}
        </div>
        <div className="flex flex-col items-left justify-center h-full mb-8 lg:mb-0">
          <p className="mb-2 text-xl">
            Max Drawdown: {" "}
            TBC
            {/* <RyskTooltip
              id="drawdownTip"
              message="Maximum drawdown indicates the downside risk of the vault since inceptions. <br />
                A low maximum drawdown is preferred as it indicates that losses from investment were small."
            /> */}
          </p>
          {/* <a
            href="https://docs.rysk.finance"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            Learn more
          </a> */}
        </div>
      </div>
    </div>
  );
};
