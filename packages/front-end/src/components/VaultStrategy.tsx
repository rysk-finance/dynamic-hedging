import React, { useState } from "react";
import { DHV_NAME } from "../config/constants";
import { Button } from "./shared/Button";

// const STRATEGY_DETAILS = [
//   {
//     name: "Strangle",
//     title: "Short Strangle",
//     src: "/images/strangles.png",
//     description:
//       "The Short Strangle is a neutral strategy where an OTM Call and a OTM Put Options are sold simultaneously of same underlying asset and expiry date.",
//   },
//   {
//     name: "Straddle",
//     title: "Short Straddle",
//     src: "/images/straddles.png",
//     description:
//       "The Short Straddle is a neutral options strategy. This strategy involves simultaneously selling a call and a put option of the same underlying asset, same strike price and same expiry date.",
//   },
//   {
//     name: "Call",
//     title: "Naked Call",
//     src: "/images/call.png",
//     description:
//       "Short Call (or Naked Call) strategy involves the selling of the Call Options.",
//   },
//   {
//     name: "Put",
//     title: "Short Put",
//     src: "/images/put.png",
//     description: "Short Put strategy involves the selling of the Put Options.",
//   },
// ];

// const STRATEGY_HEDGING = [
//   {
//     name: "Options",
//     src: "/images/bento.png",
//     description:
//       "Rysk could buy back options to reduce the gamma exposure of the pool and rebalance delta",
//   },
//   {
//     name: "Spot",
//     src: "/images/uniswap.png",
//     description:
//       "Uniswap could be used to trade spot and rebalance the delta exposure",
//   },
//   {
//     name: "Perpetuals",
//     src: "/images/rage.svg",
//     description:
//       "Rage.trade perpetuals could be traded to hedge position and rebalance the delta exposure",
//   },
// ];

const STRATEGY_STEPS = [
  {
    name: "Trade",
    title: "1. Trade Options",
    src: "/images/strangles.png",
    description:
      [
        `${DHV_NAME} trade ETH options targeting delta close to zero.`,
        "A Delta zero means that the exposure is neutral to ETH market movements.",
      ]
  },
  {
    name: "Hedge",
    title: "2. Dynamically Hedge",
    src: "/images/hedge.png",
    description:
    [
      `As the market conditions change the delta exposure of ${DHV_NAME} moves from zero.`,
      `The ${DHV_NAME} dynamically hedges the positions to reduce the directionality.`, 
    ]
  },
];

export const VaultStrategy = () => {
  const [strategy, setStrategy] = useState<string>("Trade");

  // const [hedging, setHedging] = useState<string>("Options");

  return (
    <div className="pb-8 py-12 px-8">
      <div className="grid grid-cols-2 mb-16">
        <div className="pr-8">
          <h4>Dynamic Hedging Overview</h4>
          {/* <p className="pt-4 mr-8">
            USDC deposited into {DHV_NAME} are used as collateral to run short
            options strategies such as strangles, straddles, or single legs
            (puts and calls) targeting a{" "}
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
            <br />
            By running the short options strategies the {DHV_NAME} is able to
            generate uncorrelated returns whilst targeting market neutrality.
            <br />
          </p> */}
          <p className="pt-4">
            The USDC deposited into {DHV_NAME} vault is used to fund ETH options strategies.
          </p>
          <p className="pt-4">
            The {DHV_NAME} runs short ETH options strategies
            such as strangles, straddles, or single legs
            (naked calls and short puts) targeting a{" "}
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
            If the {DHV_NAME} delta moves far from zero the
            position will be dynamically hedged by trading spot, 
            other derivatives (such as perpetuals), 
            or buying options to minimize the market exposure 
            and reduce directionality.
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
                .title.replace(/\s/g, "_")
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
                <div >
                  {
                    STRATEGY_STEPS.filter((item) => item.name === strategy)[0]
                      .description.map((listItem, index) => {
                        return(
                          <p key={index}>
                            { listItem}
                          </p>
                        )
                      })
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* <hr className="mb-8 border-gray-600" />
      <div className="grid grid-cols-2">
        <div>
          <h4 className="pt-8">Hedging</h4>
          <p className="pt-4 pr-4">
            If the portfolio delta moves far away from zero the {DHV_NAME}{" "}
            position will be hedged by trading options, spot or perpetuals. The{" "}
            {DHV_NAME} could also buy back options and to reduce the gamma
            exposure.
          </p>
        </div>
        <div className="rounded-lg mt-8 mr-8 mb-8">
          <div className="pb-4">
            {STRATEGY_HEDGING.map((item, index) => {
              return (
                <Button
                  onClick={() => setHedging(item.name)}
                  key={index}
                  className="mr-2 mb-2"
                  color={item.name === hedging ? "black" : "white"}
                >
                  {item.name}
                </Button>
              );
            })}
          </div>

          <div className="rounded-t-lg bg-black text-white flex justify-center py-2 mt-16 md:mt-0">
            <p>
              {STRATEGY_HEDGING.filter(
                (item) => item.name === hedging
              )[0].name.toLowerCase()}
              .png
            </p>
          </div>
          <div>
            <div className="border-black border-2 rounded-b-lg p-8 overflow-hidden bg-bone">
              <div className="flex justify-around items-center">
                <img
                  src={
                    STRATEGY_HEDGING.filter((item) => item.name === hedging)[0]
                      .src
                  }
                  className="mr-8 h-[150px]"
                />
                <p>
                  {
                    STRATEGY_HEDGING.filter((item) => item.name === hedging)[0]
                      .description
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div> */}
    </div>
  );
};
