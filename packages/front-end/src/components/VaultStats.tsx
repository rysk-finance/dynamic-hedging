import React from "react";
import NumberFormat from "react-number-format";
import { Card } from "./shared/Card";

export const VaultStats = () => {

  return (
    <Card tabPunchColor="bone" headerContent="DHV.stats">
      <div className="pb-8 py-12 px-8 flex flex-col lg:flex-row h-full">
        <div className="flex h-full w-full justify-around">
          <div className="flex flex-col items-center justify-center h-full mb-8 lg:mb-0">
            <h3 className="mb-2">
                <NumberFormat
                  value={"200"} 
                  displayType={"text"} 
                  decimalScale={2} 
                  suffix="%" />
            </h3>
            <h4 className="mb-2">Historical APY</h4>
            <a href="#" className="underline">
              Learn more
            </a>
          </div>
          <div className="flex flex-col items-center justify-center h-full mb-8 lg:mb-0">
            <h3 className="mb-2">
                <NumberFormat
                  value={"45000%"} 
                  displayType={"text"} 
                  decimalScale={2} 
                  suffix="%" />
            </h3>
            <h4 className="mb-2">Projected APY</h4>
            <a href="#" className="underline">
              Learn more
            </a>
          </div>
          <div className="flex flex-col items-center justify-center h-full mb-8 lg:mb-0">
            <h3 className="mb-2">
                <NumberFormat
                  value={"10"} 
                  displayType={"text"} 
                  decimalScale={2} 
                  suffix="%" />
            </h3>
            <h4 className="mb-2">Current Delta</h4>
            <a href="#" className="underline">
              Learn more
            </a>
          </div>
          <div className="flex flex-col items-center justify-center h-full mb-8 lg:mb-0">
            <h3 className="mb-2">
                <NumberFormat
                  value={"2"} 
                  displayType={"text"} 
                  decimalScale={2} 
                  suffix="%" />
            </h3>
            <h4 className="mb-2">Max Drowdown</h4>
            <a href="#" className="underline">
              Learn more
            </a>
          </div>
        </div>
      </div>
    </Card>
  )
}