import React, { useState } from "react";
import { DHV_NAME } from "../config/constants";
import { Button } from "./shared/Button";

const STRATEGY_STEPS = [
  {
    name: "Trade",
    title: "1. Trade Options",
    src: "/images/strangles.png",
    description: [
      `${DHV_NAME} trade ETH options targeting delta close to zero.`,
      "A Delta zero means that the exposure is neutral to ETH market movements.",
    ],
  },
  {
    name: "Hedge",
    title: "2. Dynamically Hedge",
    src: "/images/hedge.png",
    description: [
      `As the market conditions change the delta exposure of ${DHV_NAME} moves from zero.`,
      `The ${DHV_NAME} dynamically hedges the positions to reduce the directionality.`,
    ],
  },
];

export const VaultStrategy = () => {
  const [strategy, setStrategy] = useState<string>("Trade");

  return (
    <div className="pb-8 py-12 px-8">
      <div className="grid grid-cols-2 mb-16">
        <div className="pr-8">
          <h4>Dynamic Hedging Overview</h4>
          <p className="pt-4">
            USDC deposited into {DHV_NAME} vault is used to fund ETH options
            strategies.
          </p>
          <p className="pt-4">
            The {DHV_NAME} runs short ETH options strategies such as strangles,
            straddles, or single legs (naked calls and short puts) targeting a{" "}
            <a
              href="https://medium.com/@rysk-finance/looking-under-the-hood-of-rysks-dynamic-hedging-vault-e059e1b87e41"
              target="_blank"
              rel="noreferrer"
              className="underline hover:font-medium"
            >
              portfolio delta
            </a>{" "}
            close to zero.
            <br />
          </p>
          <p className="pt-4">
            If the {DHV_NAME} delta moves too far from zero, the position will
            be dynamically hedged by trading spot, other derivatives (such as
            perpetuals), or buying options to minimize the market exposure and
            reduce directionality.
          </p>
        </div>

        <div className="rounded-lg mr-8">
          <div className="pb-4">
            {STRATEGY_STEPS.map((item, index) => {
              return (
                <Button
                  onClick={() => setStrategy(item.name)}
                  key={index}
                  className="mr-2 mb-2"
                  color={item.name === strategy ? "black" : "white"}
                >
                  {item.title}
                </Button>
              );
            })}
          </div>

          <div className="rounded-t-lg bg-black text-white flex justify-center py-2 mt-16 md:mt-0">
            <p>
              {STRATEGY_STEPS.filter((item) => item.name === strategy)[0]
                .title.split(".")
                .join("")
                .replace(/\s/g, "_")
                .toLowerCase()}
              .png
            </p>
          </div>
          <div>
            <div className="border-black border-2 rounded-b-lg p-8 overflow-hidden bg-bone">
              <div className="flex justify-around items-center">
                <img
                  src={
                    STRATEGY_STEPS.filter((item) => item.name === strategy)[0]
                      .src
                  }
                  className="mr-8 h-[150px]"
                />
                <div>
                  {STRATEGY_STEPS.filter(
                    (item) => item.name === strategy
                  )[0].description.map((listItem, index) => {
                    return <p key={index}>{listItem}</p>;
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
