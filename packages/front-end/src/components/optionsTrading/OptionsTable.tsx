import { useEffect, useState } from "react";
import { useNetwork } from "wagmi";

import PVFABI from "../../abis/AlphaPortfolioValuesFeed.json";
import ERC20ABI from "../../abis/erc20.json";
import LPABI from "../../abis/LiquidityPool.json";
import ORABI from "../../abis/OptionRegistry.json";
import PFABI from "../../abis/PriceFeed.json";
import BPABI from "../../abis/BeyondPricer.json";
import { useGlobalContext } from "../../state/GlobalContext";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import {
  Option,
  OptionsTradingActionType,
  OptionType
} from "../../state/types";
import { useContract } from "../../hooks/useContract";
import NumberFormat from "react-number-format";
import addresses from "../../contracts.json";
import { ContractAddresses, ETHNetwork } from "../../types";
import { LiquidityPool } from "../../types/LiquidityPool";
import { PriceFeed } from "../../types/PriceFeed";
import { fromWei, tFormatUSDC, toWei } from "../../utils/conversion-helper";
import {
  calculateOptionDeltaLocally,
  returnIVFromQuote,
} from "../../utils/helpers";

const isNotTwoDigitsZero = (price: number) => {
  // TODO: Not sure this makes sense, come back to it after figuring out pricing
  return price.toFixed(2) != "0.00";
};

const suggestedCallOptionPriceDiff = [-100, 0, 100, 200, 300, 400, 600, 800];
const suggestedPutOptionPriceDiff = [
  -800, -600, -400, -300, -200, -100, 0, 100,
];

export const OptionsTable = () => {
  const { chain } = useNetwork();

  const {
    state: { ethPrice },
  } = useGlobalContext();

  const [cachedEthPrice, setCachedEthPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!cachedEthPrice && ethPrice) {
      setCachedEthPrice(Number((ethPrice / 100).toFixed(0)) * 100);
    }
  }, [ethPrice, cachedEthPrice]);

  const {
    state: { optionType, customOptionStrikes, expiryDate },
    dispatch,
  } = useOptionsTradingContext();

  // TODO: put down the actual type
  const [suggestions, setSuggestions] = useState<Array<any> | null>(null);

  const [liquidityPool] = useContract<any>({
    contract: "liquidityPool",
    ABI: LPABI,
  });

  const [beyondPricer] = useContract<any>({
    contract: "beyondPricer",
    ABI: BPABI,
  });

  const [optionRegistry] = useContract({
    contract: "OpynOptionRegistry",
    ABI: ORABI,
  });

  const [priceFeed] = useContract({
    contract: "priceFeed",
    ABI: PFABI,
  });

  const [portfolioValuesFeed] = useContract({
    contract: "portfolioValuesFeed",
    ABI: PVFABI,
  });

  const [usdc] = useContract({
    contract: "USDC",
    ABI: ERC20ABI,
  });

  useEffect(() => {
    if (cachedEthPrice && chain && liquidityPool) {
      const diffs =
        optionType === OptionType.CALL
          ? suggestedCallOptionPriceDiff
          : suggestedPutOptionPriceDiff;

      const strikes = [
        ...diffs.map<number>((diff) =>
          Number((cachedEthPrice + diff).toFixed(0))
        ),
        ...customOptionStrikes,
      ].sort((a, b) => a - b);

      const fetchPrices = async () => {
        const typedAddresses = addresses as Record<
          ETHNetwork,
          ContractAddresses
        >;
        const network = chain.network as ETHNetwork;
        const suggestions = await Promise.all(
          strikes.map(async (strike) => {
            const optionSeriesCall = {
              // TODO make sure this UTC set is done in the right place
              expiration: Number(expiryDate?.setUTCHours(8, 0, 0)) / 1000,
              strike: toWei(strike.toString()),
              strikeAsset: typedAddresses[network].USDC,
              underlying: typedAddresses[network].WETH,
              collateral: typedAddresses[network].USDC,
              isPut: false,
            };

            const optionSeriesPut = {
              ...optionSeriesCall,
              isPut: false, // TODO: Change this to true after figuring out why contracts reverts
            };

            const quoteAskCall = await beyondPricer?.quoteOptionPrice(
              optionSeriesCall,
              "1000000000000000000", // 1 for the table view but fetch if user wants to buy more
              false,
              0
            );
            const quoteAskPut = await beyondPricer?.quoteOptionPrice(
              optionSeriesPut,
              "1000000000000000000", // 1 for the table view but fetch if user wants to buy more
              false,
              0 // NOTE: not sure where to get this from
            );

            const quoteAskCallTotal = tFormatUSDC(
              quoteAskCall[0].add(quoteAskCall[2])
            );
            const quoteAskPutTotal = tFormatUSDC(
              quoteAskPut[0].add(quoteAskPut[2])
            );

            const quoteBidCall = await beyondPricer?.quoteOptionPrice(
              optionSeriesCall,
              "1000000000000000000", // 1 for the table view but fetch if user wants to sell more
              true,
              0
            );
            const quoteBidPut = await beyondPricer?.quoteOptionPrice(
              optionSeriesPut,
              "1000000000000000000", // 1 for the table view but fetch if user wants to sell more
              true,
              0
            );

            const quoteBidCallTotal = tFormatUSDC(
              quoteBidCall[0].add(quoteBidCall[2])
            );
            const quoteBidPutTotal = tFormatUSDC(
              quoteBidPut[0].add(quoteBidPut[2])
            );

            const localDeltaCall = await calculateOptionDeltaLocally(
              liquidityPool as LiquidityPool,
              priceFeed as PriceFeed,
              optionSeriesCall,
              toWei((1).toString()),
              false
            );

            const localDeltaPut = await calculateOptionDeltaLocally(
              liquidityPool as LiquidityPool,
              priceFeed as PriceFeed,
              optionSeriesPut,
              toWei((1).toString()),
              false // TODO: Figure out if we need 1 more column for shorting true
            );

            // QUESTION: Calculated on total including fees?
            const ivAskCall = await returnIVFromQuote(
              quoteAskCallTotal,
              priceFeed as PriceFeed,
              optionSeriesCall
            );
            const ivBidCall = await returnIVFromQuote(
              quoteBidCallTotal,
              priceFeed as PriceFeed,
              optionSeriesCall
            );

            const ivAskPut = await returnIVFromQuote(
              quoteAskPutTotal,
              priceFeed as PriceFeed,
              optionSeriesPut
            );
            const ivBidPut = await returnIVFromQuote(
              quoteBidPutTotal,
              priceFeed as PriceFeed,
              optionSeriesPut
            );

            return {
              strike: strike,
              IV: 13,
              call: {
                bid: {
                  IV: ivBidCall,
                  quote: quoteBidCallTotal,
                },
                ask: {
                  IV: ivAskCall,
                  quote: quoteAskCallTotal,
                },
                delta: Number(fromWei(localDeltaCall).toString()),
              },
              put: {
                bid: {
                  IV: ivBidPut,
                  quote: quoteBidPutTotal,
                },
                ask: {
                  IV: ivAskPut,
                  quote: quoteAskPutTotal,
                },
                delta: Number(fromWei(localDeltaPut).toString()),
              },
            };
          })
        );
        setSuggestions(suggestions);
      };

      fetchPrices().catch(console.error);
    }
  }, [
    chain,
    cachedEthPrice,
    optionType,
    customOptionStrikes,
    expiryDate,
    liquidityPool,
    priceFeed,
    portfolioValuesFeed,
    optionRegistry,
    usdc,
  ]);

  const setSelectedOption = (option: Option) => {
    dispatch({ type: OptionsTradingActionType.SET_SELECTED_OPTION, option });
  };

  return (
    <table className="w-full bg-white border-b-2 border-black">
      <thead className="text-left border-b-2 border-black">
        <tr className="text-center bg-gray-500 border-b-2 border-black">
          <th colSpan={5} className={"py-2"}>
            CALLS
          </th>
          <th colSpan={1}>Dec 30</th>
          <th colSpan={5}>PUTS</th>
        </tr>
        <tr className="text-center">
          <th className="py-2">Bid IV</th>
          <th className="">Bid</th>
          <th className="">Ask</th>
          <th>Ask IV</th>
          <th>Delta</th>
          <th className="bg-bone-dark border-x border-black">Strike</th>
          <th>Bid IV</th>
          <th className="">Bid</th>
          <th className="">Ask</th>
          <th>Ask IV</th>
          <th>Delta</th>
        </tr>
      </thead>
      <tbody>
        {suggestions?.map((option, index) => (
          <tr
            className={`text-right h-12 ${
              index % 2 === 0 ? "bg-gray-300" : ""
            } cursor-pointer`}
            onClick={() => setSelectedOption(option)}
            key={option.strike}
          >
            <td className="pr-4">
              <NumberFormat
                value={
                  isNotTwoDigitsZero(option.call.bid.IV)
                    ? option.call.bid.IV
                    : "-"
                }
                displayType={"text"}
                decimalScale={2}
                suffix={"%"}
              />
            </td>
            <td className="pr-4 text-red-700">
              <NumberFormat
                value={
                  isNotTwoDigitsZero(option.call.bid.quote)
                    ? option.call.bid.quote
                    : ""
                }
                displayType={"text"}
                decimalScale={2}
                prefix={"$"}
              />
            </td>
            <td className="pr-4 text-green-700">
              <NumberFormat
                value={
                  isNotTwoDigitsZero(option.call.ask.quote)
                    ? option.call.ask.quote
                    : ""
                }
                displayType={"text"}
                decimalScale={2}
                prefix={"$"}
              />
            </td>
            <td className="pr-4">
              <NumberFormat
                value={
                  isNotTwoDigitsZero(option.call.ask.IV)
                    ? option.call.ask.IV
                    : "-"
                }
                displayType={"text"}
                decimalScale={2}
                suffix={"%"}
              />
            </td>
            <td className="pr-4">
              <NumberFormat
                value={option.call.delta}
                displayType={"text"}
                decimalScale={2}
              />
            </td>
            <td className="w-20 text-center bg-bone-dark border-x border-black">
              {option.strike}
            </td>
            {/** TODO numbers below are same as calls here */}
            <td className="pr-4">
              <NumberFormat
                value={
                  isNotTwoDigitsZero(option.put.bid.IV)
                    ? option.put.bid.IV
                    : "-"
                }
                displayType={"text"}
                decimalScale={2}
                suffix={"%"}
              />
            </td>
            <td className="pr-4 text-red-700">
              <NumberFormat
                value={
                  isNotTwoDigitsZero(option.put.bid.quote)
                    ? option.put.bid.quote
                    : ""
                }
                displayType={"text"}
                decimalScale={2}
                prefix={"$"}
              />
            </td>
            <td className="pr-4 text-green-700">
              <NumberFormat
                value={
                  isNotTwoDigitsZero(option.put.ask.quote)
                    ? option.put.ask.quote
                    : ""
                }
                displayType={"text"}
                decimalScale={2}
                prefix={"$"}
              />
            </td>
            <td className="pr-4">
              <NumberFormat
                value={
                  isNotTwoDigitsZero(option.put.ask.IV)
                    ? option.put.ask.IV
                    : "-"
                }
                displayType={"text"}
                decimalScale={2}
                suffix={"%"}
              />
            </td>
            <td className="pr-4">
              <NumberFormat
                value={option.put.delta}
                displayType={"text"}
                decimalScale={2}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};