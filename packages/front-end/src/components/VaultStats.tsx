import React from "react";
import NumberFormat from "react-number-format";
import { Card } from "./shared/Card";
import ReactTooltip from 'react-tooltip';

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
                  suffix="%" />
            </h3>
            <h4 className="mb-2">
              Cumulative Yield
              <button data-tip data-for="yieldTip" className="cursor-help pl-2" >
                <img src="/icons/info.svg" />
              </button>
            </h4>
            <a href="https://docs.rysk.finance" className="underline" target="_blank" rel="noreferrer">
              Learn more
            </a>

            {/* TODO modify date */}
            <ReactTooltip 
              id="yieldTip" 
              place="bottom"
              multiline={true}
              backgroundColor="#EDE9DD"
              textColor="black"
              border={true}
              borderColor="black"
              >
              Sum of DHV returns since inception (Jul 1st 2022)
            </ReactTooltip>
          </div>
          <div className="flex flex-col items-center justify-center h-full mb-8 lg:mb-0">
            <h3 className="mb-2">
                <NumberFormat
                  value={"23.45%"} 
                  displayType={"text"} 
                  decimalScale={2} 
                  suffix="%" />
            </h3>
            <h4 className="mb-2">
              Projected APY
              <button data-tip data-for="apyTip" className="cursor-help pl-2" >
                <img src="/icons/info.svg" />
              </button>
            </h4>
            <a href="https://docs.rysk.finance" className="underline" target="_blank" rel="noreferrer">
              Learn more
            </a>
            <ReactTooltip 
              id="apyTip" 
              place="bottom"
              multiline={true}
              backgroundColor="#EDE9DD"
              textColor="black"
              border={true}
              borderColor="black"
              >
              Based on DHV historical returns and the current DHV options exposure
            </ReactTooltip>
          </div>
          <div className="flex flex-col items-center justify-center h-full mb-8 lg:mb-0">
            <h3 className="mb-2">
                <NumberFormat
                  value={"13.78"} 
                  displayType={"text"} 
                  decimalScale={2} 
                  suffix="%" />
            </h3>
            <h4 className="mb-2">
              Current Delta
              <button data-tip data-for="deltaTip" className="cursor-help pl-2" >
                <img src="/icons/info.svg" />
              </button>
            </h4>
            <a href="https://docs.rysk.finance" className="underline" target="_blank" rel="noreferrer">
              Learn more
            </a>
            <ReactTooltip 
              id="deltaTip" 
              place="bottom"
              multiline={true}
              backgroundColor="#EDE9DD"
              textColor="black"
              border={true}
              borderColor="black"
              >
              Current Delta of the DHV option exposure
            </ReactTooltip>
          </div>
          <div className="flex flex-col items-center justify-center h-full mb-8 lg:mb-0">
            <h3 className="mb-2">
                <NumberFormat
                  value={"2.45"} 
                  displayType={"text"} 
                  decimalScale={2} 
                  suffix="%" />
            </h3>
            <h4 className="mb-2">
              Max Drawdown
              <button data-tip data-for="drawdownTip" className="cursor-help pl-2" >
                <img src="/icons/info.svg" />
              </button>
            </h4>
            <a href="https://docs.rysk.finance" className="underline" target="_blank" rel="noreferrer">
              Learn more
            </a>
            <ReactTooltip 
              id="drawdownTip" 
              place="bottom"
              multiline={true}
              backgroundColor="#EDE9DD"
              textColor="black"
              border={true}
              borderColor="black"
              >
              Maximum Observed Loss in DHV from peak to a trough 
            </ReactTooltip>
          </div>
        </div>
      </div>
    </Card>
  )
}