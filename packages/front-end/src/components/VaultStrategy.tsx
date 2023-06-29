import { useState } from "react";
import { DHV_NAME } from "../config/constants";
import { Button } from "./shared/Button";

const STRATEGY_STEPS = [
  {
    name: "Deposit",
    title: "1. Deposit",
    src: "/images/1_deposit.png",
    description: [
      `Depositors deposit USDC into ${DHV_NAME} vault to earn uncorrelated returns.`,
      `The USDC deposited are used to fund ETH options trades and the ${DHV_NAME} acts as an automated market maker (AMM) for the option market.`
    ],
  },
  {
    name: "Price",
    title: "2. Price",
    src: "/images/2_price.png",
    description: [
      `The ${DHV_NAME} uses its own pricing mechanism to price ETH options.`,
      `The ${DHV_NAME} quotes:`,
      `- a price to SELL the option to a trader;`,
      `- a price to BUY the option from trader.`,
      `The difference (spread) between the sell and buy price forms the uncorrelated returns generated to the depositors.`,
      `The vault Revenue Potential for the Depositors comes from Spread * Volume.`
    ],
  },
  {
    name: "Trade",
    title: "3. Trade",
    src: "/images/3_trade.png",
    description: [
      `The ${DHV_NAME} acts as a counterparty to options traders:`,
      `- when an option is minted and SOLD, the vault locks collateral and COLLECTS premium`,
      `- when an option is BOUGHT, the vault PAYS OUT a premium`,
      `The ${DHV_NAME} is targeting to turn over option inventory as much as possible since that will decrease risk and increase revenue (assuming the same spread) increasing profitability for depositors.`
    ],
  },
  {
    name: "Hedge",
    title: "4. Dynamic Hedging",
    src: "/images/4_hedge.png",
    description: [
      `At all times ${DHV_NAME} will be aware of its own position and will price its options in such a way as to incentivize the sale/purchase of options that bring its exposures closer to 0.`,
      `During periods of sustained stronger demand in one direction and where the rebalancing incentivisation alone isn't enough, ${DHV_NAME} can immediately hedge delta, in either direction by trading spot or other derivatives (such as perpetuals) to minimize the market exposure and reduce directionality.`
    ],
  },
];

export const VaultStrategy = () => {
  const [strategy, setStrategy] = useState<string>("Deposit");

  return (
    <div className="pb-8 py-12 px-8">
      <div className="grid grid-cols-2 mb-16">
        <div className="pr-8">
          <h4 className="text-xl">Dynamic Hedging Overview</h4>
          <p className="pt-4">
            The DHV acts as a permissionless vanilla options AMM (Automated Market Maker), allowing anyone to trade (buy or sell) using the vault as counterparty.
          </p>
          <p className="pt-4">
            USDC deposited into {DHV_NAME} vault is used to fund ETH options trading, as collateral for the options sold by the DHV or as premium paid for options being bought by the DHV. 
          </p>
          <p className="pt-4">
            The DHV collects premiums from traders buying options from the vault and pays out a premium for each option sold to the vault. 
            The corresponding spread between the buy and sell forms the yield generated to depositors.
          </p>
          <p className="pt-4">
            At all times the DHV will be aware of its own position, targeting a{" "}
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
            If the {DHV_NAME} delta moves too far from zero, the position will
            be dynamically hedged to minimize the market exposure and
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
                  className="mr-8 h-[200px]"
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
