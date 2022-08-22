import React, { useState } from "react";
import { DHV_NAME } from "../config/constants";
import { Button } from "./shared/Button";

export const VaultStrategy = () => {

  const [strategy, setStrategy] = useState<string>('strangles');

  const strategyDetails = [
    { 
      'name': 'strangles',
      'src': '/images/strangles.png',
      'description': "The Short Strangle is a neutral strategy where an OTM Call and a OTM Put Options are sold simultaneously of same underlying asset and expiry date." 
    },
    { 
      'name': 'straddles',
      'src': '/images/straddles.png',
      'description': "The Short Straddle is a neutral options strategy. This strategy involves simultaneously selling a call and a put option of the same underlying asset, same strike price and same expire date." 
    }
  ]

  const [hedging, setHedging] = useState<string>('spot');

  const strategyHedging = [
    { 
      'name': 'options',
      'src': '/images/bento.png',
      'description': "Rysk could buy back options to reduce the gamma exposure of the pool and rebalance delta" 
    },
    { 
      'name': 'spot',
      'src': '/images/uniswap.png',
      'description': "Uniswap could be used to trade spot and rebalance the delta exposure" 
    },
    { 
      'name': 'perpetuals',
      'src': '/images/rage.svg',
      'description': "Rage.trade perpetuals could be traded to hedge position and rebalance the delta exposure" 
    }
  ]

  return (
    <div className="pb-8 py-12 px-8">
      <div className="grid grid-cols-2">

        <div>
          <h4>Strategy</h4>
          <p className="pt-4 mr-8">
            USDC deposited into {DHV_NAME} are used as collateral to run short options strategies such as 
            strangles, straddles, or single legs (puts and calls) targeting a {" "}
            <a 
              href="https://medium.com/@rysk-finance/looking-under-the-hood-of-rysks-dynamic-hedging-vault-e059e1b87e41" 
              target="_blank"
              rel="noreferrer"
              className="underline hover:font-medium"
              >
               portfolio delta
            </a> 
             {" " }
            close to zero. 
            <br />
            By running the short options strategies the {DHV_NAME} is able to generate uncorrelated returns whilst targeting market neutrality.
            <br />
          </p>

          <div className="rounded-lg mt-8 mr-8">
            <div className="pb-4">
              <Button onClick={() => setStrategy('strangles')}>Strangles</Button>
              <Button onClick={() => setStrategy('straddles')}>Straddles</Button>
            </div>

            <div className="rounded-t-lg bg-black text-white flex justify-center py-2 mt-16 md:mt-0">
              <p>{strategyDetails.filter( item => item.name === strategy)[0].name}.png</p>
            </div>
            <div>
              <div className="border-black border-2 rounded-b-lg p-8 overflow-hidden bg-bone">
                <div className="flex justify-center">
                  <img src={ strategyDetails.filter( item => item.name === strategy)[0].src } className="mr-8 h-[150px]" />
                  <p>
                    { strategyDetails.filter( item => item.name === strategy)[0].description }
                  </p>
                </div>
              </div>
            </div>
          </div>

          <h4 className="pt-8">Hedging</h4>
          <p className="pt-4 pr-4">
            If the portfolio delta moves far away from zero the {DHV_NAME} position will be hedged by trading options, 
            spot or perpetuals. The {DHV_NAME} could also buy back options and to reduce the gamma exposure.

            <div className="rounded-lg mt-8 mr-8">
              <div className="pb-4">
                <Button onClick={() => setHedging('spot')}>Spot</Button>
                <Button onClick={() => setHedging('perpetuals')}>Perpetuals</Button>
                <Button onClick={() => setHedging('options')}>Options</Button>
              </div>

              <div className="rounded-t-lg bg-black text-white flex justify-center py-2 mt-16 md:mt-0">
                <p>{strategyHedging.filter( item => item.name === hedging)[0].name}.png</p>
              </div>
              <div>
                <div className="border-black border-2 rounded-b-lg p-8 overflow-hidden bg-bone">
                  <div className="flex justify-center">
                    <img src={ strategyHedging.filter( item => item.name === hedging)[0].src } className="mr-8 h-[150px]" />
                    <p>
                      { strategyHedging.filter( item => item.name === hedging)[0].description }
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </p>
        </div>

        <div>
          <h4>How it works</h4>
          <h5 className="mt-8">Deposit</h5>
          <p className="pt-4">
            <ul className="list-decimal px-8">
              <li>Deposit USDC into {DHV_NAME} vault.</li>
              <li>
                Your USDC deposit will be queued till the next epoch start. At
                this stage you can also deposit additional USDC.
              </li>
              <li>
                Once the new epoch starts your deposit will be converted
                to shares which can then be redeemed.
              </li>
              <li>
                Your shares value could appreciate over-time as the {DHV_NAME}
                generates returns.
              </li>
            </ul>
          </p>
          <h5 className="mt-8">Withdraw</h5>
          <p className="pt-4">
            <ul className="list-decimal px-8">
              <li>
                You can withdraw all of part of your shares. You can
                initiate a withdrawal at any time.
              </li>
              <li>Your withdraw will be queued till the next epoch.</li>
              <li>
                Once the new epoch starts you can complete your withdraw
                and redeem your USDC.
              </li>
            </ul>
          </p>
        </div>

      </div>
    </div>
  );
};
